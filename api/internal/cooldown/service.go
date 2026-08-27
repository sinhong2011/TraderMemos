package cooldown

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"
	"uuid"

	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/store"
)

// AlertRule is the alert_events rule under which auto-started cooldowns are
// announced (one push per session; the session id is the dedupe key).
const AlertRule = "cooldown"

// AppURL is the deep link a push tap follows into the cooldown screen.
const AppURL = "tradermemos://cooldown"

// Notifier delivers a one-off event through the user's alert channels.
// *alerts.Service satisfies it; nil disables the push.
type Notifier interface {
	Fire(ctx context.Context, userID string, ev alerts.Event) error
}

// Service starts cooldowns automatically when a tripped risk rule says the
// trader should step away. It runs off the same after-write hook as alerts
// and is safe for concurrent use.
type Service struct {
	q      store.Querier
	log    *slog.Logger
	notify Notifier
	now    func() time.Time
	// debounce delays async evaluations so a burst of writes (CSV import,
	// flex sync) evaluates once after the dust settles.
	debounce time.Duration

	mu       sync.Mutex
	inflight map[string]bool
}

// NewService builds the auto-cooldown service.
func NewService(q store.Querier, notify Notifier, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{
		q:      q,
		log:    log,
		notify: notify,
		// UTC like the handlers: SQLite keeps timestamps as text, so a
		// local-offset stamp from here would sort against the handlers'
		// "Z" stamps by string, not by instant.
		now:      func() time.Time { return time.Now().UTC() },
		debounce: 2 * time.Second,
		inflight: map[string]bool{},
	}
}

// TradeWritten schedules an async evaluation for the user. Calls made while
// one is already queued coalesce into it.
func (s *Service) TradeWritten(userID string) {
	s.mu.Lock()
	if s.inflight[userID] {
		s.mu.Unlock()
		return
	}
	s.inflight[userID] = true
	s.mu.Unlock()
	go func() {
		time.Sleep(s.debounce)
		s.mu.Lock()
		delete(s.inflight, userID)
		s.mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		if _, err := s.EvaluateUser(ctx, userID); err != nil {
			s.log.Warn("cooldown evaluation failed", "user", userID, "err", err)
		}
	}()
}

// EvaluateUser starts a cooldown for the user if a risk rule has tripped
// today and cooldown_minutes is set. It returns the new session, or nil when
// nothing started: auto cooldown off, nothing tripped, a session already
// open, or the same trigger already handled today.
func (s *Service) EvaluateUser(ctx context.Context, userID string) (*store.CooldownSession, error) {
	rules, err := s.q.GetRiskRules(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	// Master switch first: an auto-start the trader can't see anywhere is
	// worse than no circuit breaker at all.
	if rules.CooldownEnabled == 0 {
		return nil, nil
	}
	if !rules.CooldownMinutes.Valid || rules.CooldownMinutes.Int64 <= 0 {
		return nil, nil
	}
	r := Rules{CooldownMinutes: int(rules.CooldownMinutes.Int64)}
	if rules.MaxDailyLoss.Valid {
		r.MaxDailyLoss = rules.MaxDailyLoss.Float64
	}
	if rules.MaxTradesPerDay.Valid {
		r.MaxTradesPerDay = int(rules.MaxTradesPerDay.Int64)
	}
	if rules.MaxConsecutiveLosses.Valid {
		r.MaxConsecutiveLosses = int(rules.MaxConsecutiveLosses.Int64)
	}
	if r.MaxDailyLoss <= 0 && r.MaxTradesPerDay <= 0 && r.MaxConsecutiveLosses <= 0 {
		return nil, nil
	}
	now := s.now()
	loc := s.userLocation(ctx, userID)

	if open, oerr := s.q.GetOpenCooldownSession(ctx, userID); oerr == nil {
		if FromStore(open).Open(now) {
			return nil, nil
		}
	} else if !errors.Is(oerr, sql.ErrNoRows) {
		return nil, oerr
	}

	rows, err := s.q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: userID})
	if err != nil {
		return nil, err
	}
	trades := make([]Trade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		trades = append(trades, Trade{NetPnl: t.NetPnl.Float64, OpenedAt: t.OpenedAt, ClosedAt: t.ClosedAt.Time})
	}
	trigger := Tripped(r, trades, now, loc)
	if trigger == "" {
		return nil, nil
	}

	// One auto session per trigger per day: the trader has already been
	// handed this pause; handing it again after every fill would nag.
	history, err := s.q.ListCooldownSessions(ctx, userID)
	if err != nil {
		return nil, err
	}
	today := now.In(loc).Format("2006-01-02")
	for _, h := range history {
		if h.Trigger == trigger && h.StartedAt.In(loc).Format("2006-01-02") == today {
			return nil, nil
		}
	}

	dur := time.Duration(r.CooldownMinutes) * time.Minute
	session, err := s.q.CreateCooldownSession(ctx, store.CreateCooldownSessionParams{
		ID:        uuid.New().String(),
		UserID:    userID,
		StartedAt: now,
		EndsAt:    now.Add(dur),
		Trigger:   trigger,
	})
	if err != nil {
		return nil, err
	}
	s.log.Info("cooldown auto-started", "user", userID, "trigger", trigger, "minutes", r.CooldownMinutes)

	if s.notify != nil {
		ev := alerts.Event{
			Rule:      AlertRule,
			DedupeKey: session.ID,
			Title:     fmt.Sprintf("Cooldown started — %d min", r.CooldownMinutes),
			Body:      TriggerBody(trigger),
			URL:       AppURL,
		}
		if nerr := s.notify.Fire(ctx, userID, ev); nerr != nil {
			s.log.Warn("cooldown push failed", "user", userID, "err", nerr)
		}
	}
	return &session, nil
}

// TriggerBody is the one-line explanation shown for an auto-started session.
func TriggerBody(trigger string) string {
	switch trigger {
	case TriggerLossStreak:
		return "You hit your loss streak limit. Breathe, then answer the return gate before trading again."
	case TriggerDailyLoss:
		return "You hit your daily loss limit. Breathe, then answer the return gate before trading again."
	case TriggerTradeLimit:
		return "You hit your trades-per-day cap. Breathe, then answer the return gate before trading again."
	default:
		return "Breathe, then answer the return gate before trading again."
	}
}

// userLocation is the trader's clock for "today": the alerts timezone when
// set (the only per-user timezone the server stores), else UTC.
func (s *Service) userLocation(ctx context.Context, userID string) *time.Location {
	settings, err := s.q.GetAlertSettings(ctx, userID)
	if err != nil || settings.Timezone == "" {
		return time.UTC
	}
	if loc, lerr := time.LoadLocation(settings.Timezone); lerr == nil {
		return loc
	}
	return time.UTC
}

// FromStore converts a store row into the engine-neutral Session.
func FromStore(r store.CooldownSession) Session {
	s := Session{
		ID:            r.ID,
		StartedAt:     r.StartedAt,
		EndsAt:        r.EndsAt,
		Trigger:       r.Trigger,
		Impulse:       r.Impulse,
		ReleasedEarly: r.ReleasedEarly != 0,
		ReturnRule:    r.ReturnRule,
		Reflection:    r.Reflection,
	}
	if r.ReleasedAt.Valid {
		t := r.ReleasedAt.Time
		s.ReleasedAt = &t
	}
	if r.SetupID.Valid {
		s.SetupID = r.SetupID.String
	}
	return s
}
