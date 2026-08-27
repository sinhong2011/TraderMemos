package cooldown

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

type fakeNotifier struct{ events []alerts.Event }

func (f *fakeNotifier) Fire(_ context.Context, _ string, ev alerts.Event) error {
	f.events = append(f.events, ev)
	return nil
}

type fixture struct {
	q      store.Querier
	svc    *Service
	notify *fakeNotifier
	user   string
	acct   string
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(conn); err != nil {
		t.Fatal(err)
	}
	q := store.NewForDriver(conn, "sqlite")
	ctx := context.Background()
	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: "u1", Email: "t@example.com", PasswordHash: "x", IsAdmin: 1})
	if err != nil {
		t.Fatal(err)
	}
	a, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: "a1", UserID: u.ID, Name: "Main", Broker: "manual", AccountType: "live",
		BaseCurrency: "USD", StartingBalance: 10000,
	})
	if err != nil {
		t.Fatal(err)
	}
	n := &fakeNotifier{}
	svc := NewService(q, n, nil)
	svc.now = func() time.Time { return now }
	return &fixture{q: q, svc: svc, notify: n, user: u.ID, acct: a.ID}
}

func (f *fixture) trade(t *testing.T, id string, closedAt time.Time, pnl float64) {
	t.Helper()
	err := f.q.UpsertTrade(context.Background(), store.UpsertTradeParams{
		ID: id, UserID: f.user, AccountID: f.acct, Symbol: "AAPL", InstrumentType: "stock",
		Direction: "long", Status: "closed",
		OpenedAt: closedAt.Add(-10 * time.Minute), ClosedAt: sql.NullTime{Time: closedAt, Valid: true},
		QtyOpened: 1, AvgEntryPrice: 100, NetPnl: sql.NullFloat64{Float64: pnl, Valid: true},
		PnlCurrency: "USD",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func (f *fixture) rules(t *testing.T, minutes, streak int64) {
	t.Helper()
	f.rulesWithSwitch(t, minutes, streak, true)
}

func (f *fixture) rulesWithSwitch(t *testing.T, minutes, streak int64, enabled bool) {
	t.Helper()
	on := int64(0)
	if enabled {
		on = 1
	}
	_, err := f.q.UpsertRiskRules(context.Background(), store.UpsertRiskRulesParams{
		UserID:               f.user,
		MaxConsecutiveLosses: sql.NullInt64{Int64: streak, Valid: streak > 0},
		CooldownMinutes:      sql.NullInt64{Int64: minutes, Valid: minutes > 0},
		CooldownEnabled:      on,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestEvaluateUserStartsCooldownOnce(t *testing.T) {
	f := newFixture(t)
	f.rules(t, 15, 2)
	f.trade(t, "t1", now.Add(-2*time.Hour), -10)
	f.trade(t, "t2", now.Add(-time.Hour), -10)
	ctx := context.Background()

	s, err := f.svc.EvaluateUser(ctx, f.user)
	if err != nil {
		t.Fatal(err)
	}
	if s == nil || s.Trigger != TriggerLossStreak {
		t.Fatalf("expected a loss_streak session, got %+v", s)
	}
	if got := s.EndsAt.Sub(s.StartedAt); got != 15*time.Minute {
		t.Fatalf("duration = %v, want 15m", got)
	}
	if len(f.notify.events) != 1 || f.notify.events[0].Rule != AlertRule || f.notify.events[0].URL != AppURL {
		t.Fatalf("expected one cooldown push, got %+v", f.notify.events)
	}

	// Still open → nothing new.
	if again, err := f.svc.EvaluateUser(ctx, f.user); err != nil || again != nil {
		t.Fatalf("second evaluation should be a no-op, got %+v err=%v", again, err)
	}

	// Released, but same trigger already handled today → still nothing.
	if _, err := f.q.ReleaseCooldownSession(ctx, store.ReleaseCooldownSessionParams{
		ReleasedAt: sql.NullTime{Time: now, Valid: true}, ReturnRule: RuleNone, ID: s.ID, UserID: f.user,
	}); err != nil {
		t.Fatal(err)
	}
	f.trade(t, "t3", now.Add(-30*time.Minute), -10)
	if again, err := f.svc.EvaluateUser(ctx, f.user); err != nil || again != nil {
		t.Fatalf("same trigger twice in a day should be a no-op, got %+v err=%v", again, err)
	}
}

// The master switch outranks the thresholds: a leftover cooldown_minutes
// must not start sessions the trader can no longer see anywhere.
func TestEvaluateUserRespectsTheMasterSwitch(t *testing.T) {
	f := newFixture(t)
	f.rulesWithSwitch(t, 15, 2, false)
	f.trade(t, "t1", now.Add(-2*time.Hour), -10)
	f.trade(t, "t2", now.Add(-time.Hour), -10)
	ctx := context.Background()

	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s != nil {
		t.Fatalf("switch off: got %+v err=%v", s, err)
	}
	if len(f.notify.events) != 0 {
		t.Fatalf("no pushes expected, got %+v", f.notify.events)
	}

	f.rulesWithSwitch(t, 15, 2, true)
	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s == nil {
		t.Fatalf("switch on: got %+v err=%v", s, err)
	}
}

func TestEvaluateUserOffWhenUnset(t *testing.T) {
	f := newFixture(t)
	f.trade(t, "t1", now.Add(-2*time.Hour), -10)
	f.trade(t, "t2", now.Add(-time.Hour), -10)
	ctx := context.Background()

	// No rules row at all.
	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s != nil {
		t.Fatalf("no rules: got %+v err=%v", s, err)
	}
	// Streak rule but auto cooldown off.
	f.rules(t, 0, 2)
	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s != nil {
		t.Fatalf("cooldown off: got %+v err=%v", s, err)
	}
	// Auto cooldown on but no rule can trip.
	f.rules(t, 15, 0)
	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s != nil {
		t.Fatalf("no tripping rule: got %+v err=%v", s, err)
	}
	if len(f.notify.events) != 0 {
		t.Fatalf("no pushes expected, got %+v", f.notify.events)
	}
}

func TestEvaluateUserUsesAlertTimezone(t *testing.T) {
	f := newFixture(t)
	f.rules(t, 10, 2)
	ctx := context.Background()
	// 2026-08-07 02:00 UTC is still 2026-08-06 in New York: with the alerts
	// timezone set, these losses are "yesterday" and must not trip today.
	early := time.Date(2026, 8, 7, 2, 0, 0, 0, time.UTC)
	f.trade(t, "t1", early, -10)
	f.trade(t, "t2", early.Add(time.Minute), -10)

	if s, err := f.svc.EvaluateUser(ctx, f.user); err != nil || s == nil {
		t.Fatalf("in UTC the losses are today: got %+v err=%v", s, err)
	}

	g := newFixture(t)
	g.rules(t, 10, 2)
	g.trade(t, "t1", early, -10)
	g.trade(t, "t2", early.Add(time.Minute), -10)
	if _, err := g.q.UpsertAlertSettings(ctx, store.UpsertAlertSettingsParams{
		UserID: g.user, Enabled: 0, Timezone: "America/New_York",
	}); err != nil {
		t.Fatal(err)
	}
	if s, err := g.svc.EvaluateUser(ctx, g.user); err != nil || s != nil {
		t.Fatalf("in New York the losses were yesterday: got %+v err=%v", s, err)
	}
}
