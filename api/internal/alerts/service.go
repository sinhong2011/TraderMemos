package alerts

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/prop"
	"github.com/tradermemos/api/internal/store"
)

// Service evaluates a user's alert rules and dispatches new events to their
// channels. It is safe for concurrent use.
type Service struct {
	q   store.Querier
	log *slog.Logger
	// httpc talks to Expo's fixed push gateway; webhookc is the SSRF-guarded
	// client for user-supplied webhook URLs.
	httpc    *http.Client
	webhookc *http.Client
	now      func() time.Time
	// debounce delays async trade-write evaluations so a burst of writes
	// (CSV import, flex sync) evaluates once after the dust settles.
	debounce time.Duration

	mu       sync.Mutex
	inflight map[string]bool
}

// NewService builds the alert service. allowPrivateWebhooks lets webhook
// deliveries reach loopback/private addresses (TM_ALERTS_ALLOW_PRIVATE_WEBHOOKS).
func NewService(q store.Querier, log *slog.Logger, allowPrivateWebhooks bool) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{
		q:        q,
		log:      log,
		httpc:    &http.Client{Timeout: 20 * time.Second},
		webhookc: newWebhookClient(allowPrivateWebhooks),
		now:      time.Now,
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
		if err := s.EvaluateUser(ctx, userID); err != nil {
			s.log.Warn("alert evaluation failed", "user", userID, "err", err)
		}
	}()
}

// EvaluateUser runs every enabled rule for the user and dispatches events not
// seen before. A user with alerts disabled (or unconfigured) is a no-op.
func (s *Service) EvaluateUser(ctx context.Context, userID string) error {
	settings, err := s.q.GetAlertSettings(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if settings.Enabled == 0 {
		return nil
	}

	loc := time.UTC
	if settings.Timezone != "" {
		if l, lerr := time.LoadLocation(settings.Timezone); lerr == nil {
			loc = l
		}
	}
	now := s.now()

	cfg := Config{
		RiskEnabled:       settings.RuleRisk != 0,
		DailyLossEnabled:  settings.RuleDailyLoss != 0,
		LossStreakEnabled: settings.RuleLossStreak != 0,
		LossStreakN:       int(settings.LossStreakN),
		PropEnabled:       settings.RulePropDrawdown != 0,
		PropWarnPct:       settings.PropWarnPct,
		UnreviewedEnabled: settings.RuleUnreviewed != 0,
		UnreviewedDays:    int(settings.UnreviewedDays),
	}
	rules, err := s.q.GetRiskRules(ctx, userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil {
		if rules.MaxRiskPerTrade.Valid {
			cfg.MaxRiskPerTrade = rules.MaxRiskPerTrade.Float64
		}
		if rules.MaxDailyLoss.Valid {
			cfg.MaxDailyLoss = rules.MaxDailyLoss.Float64
		}
	}

	rows, err := s.q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: userID})
	if err != nil {
		return err
	}
	journals, err := s.q.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return err
	}
	journalByTrade := make(map[string]store.TradeJournal, len(journals))
	for _, j := range journals {
		journalByTrade[j.TradeID] = j
	}

	trades := make([]Trade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		var risk float64
		if j, ok := journalByTrade[t.ID]; ok && j.InitialRisk.Valid {
			risk = j.InitialRisk.Float64
		}
		trades = append(trades, Trade{
			ID: t.ID, Symbol: t.Symbol,
			NetPnl: t.NetPnl.Float64, ClosedAt: t.ClosedAt.Time, InitialRisk: risk,
		})
	}

	events := Evaluate(cfg, trades, now, loc)

	if cfg.PropEnabled {
		propEvents, perr := s.evaluateProp(ctx, userID, rows, cfg.PropWarnPct, now, loc)
		if perr != nil {
			return perr
		}
		events = append(events, propEvents...)
	}

	if cfg.UnreviewedEnabled && cfg.UnreviewedDays > 0 {
		cutoff := now.AddDate(0, 0, -cfg.UnreviewedDays)
		count := 0
		for _, t := range rows {
			if !t.ClosedAt.Valid || t.ClosedAt.Time.After(cutoff) {
				continue
			}
			j, ok := journalByTrade[t.ID]
			if !ok || (j.Notes == "" && !j.TradeQuality.Valid) {
				count++
			}
		}
		events = append(events, Unreviewed(count, cfg.UnreviewedDays, now, loc)...)
	}

	var fresh []Event
	for _, ev := range events {
		n, ierr := s.q.InsertAlertEvent(ctx, store.InsertAlertEventParams{
			ID: uuid.NewString(), UserID: userID,
			Rule: ev.Rule, DedupeKey: ev.DedupeKey, Title: ev.Title, Body: ev.Body,
		})
		if ierr != nil {
			return ierr
		}
		if n > 0 {
			fresh = append(fresh, ev)
		}
	}
	if len(fresh) == 0 {
		return nil
	}
	return s.dispatch(ctx, userID, fresh)
}

// evaluateProp replays each prop-configured account and collects drawdown
// alerts. rows is the user's full closed-trade list (all accounts).
func (s *Service) evaluateProp(ctx context.Context, userID string, rows []store.Trade, warnPct float64, now time.Time, loc *time.Location) ([]Event, error) {
	propRows, err := s.q.ListPropSettingsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(propRows) == 0 {
		return nil, nil
	}
	accounts, err := s.q.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	accountByID := make(map[string]store.Account, len(accounts))
	for _, a := range accounts {
		accountByID[a.ID] = a
	}
	today := now.In(loc).Format("2006-01-02")

	var events []Event
	for _, pr := range propRows {
		acct, ok := accountByID[pr.AccountID]
		if !ok {
			continue
		}
		st := prop.Settings{DrawdownMode: pr.DrawdownMode}
		if pr.MaxDrawdown.Valid {
			st.MaxDrawdown = pr.MaxDrawdown.Float64
		}
		if pr.DailyLossLimit.Valid {
			st.DailyLossLimit = pr.DailyLossLimit.Float64
		}
		if st.MaxDrawdown <= 0 {
			continue
		}
		cash, cerr := s.q.ListCashTransactions(ctx, store.ListCashTransactionsParams{
			UserID: userID, AccountID: pr.AccountID,
		})
		if cerr != nil {
			return nil, cerr
		}
		var events2 []prop.Event
		for _, t := range rows {
			if t.AccountID != pr.AccountID || !t.NetPnl.Valid || !t.ClosedAt.Valid {
				continue
			}
			events2 = append(events2, prop.Event{At: t.ClosedAt.Time, Amount: t.NetPnl.Float64, Trade: true})
		}
		for _, tx := range cash {
			events2 = append(events2, prop.Event{At: tx.OccurredAt, Amount: tx.Amount})
		}
		status := prop.Compute(acct.StartingBalance, events2, st, loc)
		events = append(events, EvaluateProp(acct.ID, acct.Name, status, warnPct, today)...)
	}
	return events, nil
}

// dispatch sends events through every enabled channel, recording each
// channel's outcome on its row. Delivery failures are recorded, not returned —
// one dead webhook must not fail the whole evaluation.
func (s *Service) dispatch(ctx context.Context, userID string, events []Event) error {
	channels, err := s.q.ListEnabledAlertChannels(ctx, userID)
	if err != nil {
		return err
	}
	if len(channels) == 0 {
		return nil
	}
	now := s.now()

	var expoChannels []store.AlertChannel
	for _, ch := range channels {
		switch ch.Kind {
		case "expo":
			expoChannels = append(expoChannels, ch)
		case "webhook":
			var sendErr error
			for _, ev := range events {
				if werr := s.sendWebhook(ctx, ch.Target, ev, now); werr != nil {
					sendErr = werr
					break
				}
			}
			s.recordOutcome(ctx, ch, now, sendErr)
		}
	}

	if len(expoChannels) > 0 {
		tokens := make([]string, len(expoChannels))
		for i, ch := range expoChannels {
			tokens[i] = ch.Target
		}
		perToken := make([]error, len(tokens))
		for _, ev := range events {
			errs, serr := s.sendExpo(ctx, tokens, ev)
			if serr != nil {
				for i := range perToken {
					perToken[i] = serr
				}
				break
			}
			for i, terr := range errs {
				if terr != nil {
					perToken[i] = terr
				}
			}
		}
		for i, ch := range expoChannels {
			s.recordOutcome(ctx, ch, now, perToken[i])
			if errors.Is(perToken[i], errDeviceNotRegistered) {
				if derr := s.q.DisableAlertChannel(ctx, ch.ID); derr != nil {
					s.log.Warn("could not disable dead push token", "channel", ch.ID, "err", derr)
				}
			}
		}
	}
	return nil
}

// SendTest pushes a test notification through one channel and records the
// outcome. Used by the settings UI's "send test" button.
func (s *Service) SendTest(ctx context.Context, ch store.AlertChannel) error {
	ev := Event{
		Rule:  RuleTest,
		Title: "Test alert",
		Body:  "TraderMemos alerts are working.",
	}
	now := s.now()
	var err error
	switch ch.Kind {
	case "expo":
		var errs []error
		errs, err = s.sendExpo(ctx, []string{ch.Target}, ev)
		if err == nil && len(errs) == 1 && errs[0] != nil {
			err = errs[0]
		}
	default:
		err = s.sendWebhook(ctx, ch.Target, ev, now)
	}
	s.recordOutcome(ctx, ch, now, err)
	return err
}

func (s *Service) recordOutcome(ctx context.Context, ch store.AlertChannel, at time.Time, sendErr error) {
	status, errMsg := "ok", ""
	if sendErr != nil {
		status, errMsg = "error", sendErr.Error()
	}
	if uerr := s.q.UpdateAlertChannelStatus(ctx, store.UpdateAlertChannelStatusParams{
		LastSentAt: sql.NullTime{Time: at, Valid: true},
		LastStatus: status,
		LastError:  errMsg,
		ID:         ch.ID,
	}); uerr != nil {
		s.log.Warn("could not record channel outcome", "channel", ch.ID, "err", uerr)
	}
	if sendErr != nil {
		s.log.Warn("alert delivery failed", "channel", ch.ID, "kind", ch.Kind, "err", sendErr)
	}
}
