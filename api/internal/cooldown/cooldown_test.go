package cooldown

import (
	"strings"
	"testing"
	"time"
)

var nyc, _ = time.LoadLocation("America/New_York")

// now is 2026-08-07 15:00 ET.
var now = time.Date(2026, 8, 7, 19, 0, 0, 0, time.UTC)

func at(day, hour, minute int) time.Time {
	return time.Date(2026, 8, day, hour, minute, 0, 0, nyc)
}

// closed makes a trade opened 10 minutes before it closed.
func closed(day, hour, minute int, pnl float64) Trade {
	c := at(day, hour, minute)
	return Trade{NetPnl: pnl, OpenedAt: c.Add(-10 * time.Minute), ClosedAt: c}
}

func TestPhase(t *testing.T) {
	s := Session{StartedAt: now, EndsAt: now.Add(15 * time.Minute)}
	if got := s.Phase(now.Add(time.Minute)); got != PhaseCounting {
		t.Fatalf("phase = %s, want counting", got)
	}
	if got := s.Phase(now.Add(16 * time.Minute)); got != PhaseGate {
		t.Fatalf("phase = %s, want gate", got)
	}
	rel := now.Add(20 * time.Minute)
	s.ReleasedAt = &rel
	if got := s.Phase(rel); got != PhaseReleased {
		t.Fatalf("phase = %s, want released", got)
	}
}

func TestOpenGoesStale(t *testing.T) {
	s := Session{StartedAt: now, EndsAt: now.Add(5 * time.Minute)}
	if !s.Open(now.Add(3 * time.Hour)) {
		t.Fatal("an unanswered gate should still lock after 3h")
	}
	if s.Open(now.Add(StaleAfter + time.Minute)) {
		t.Fatal("a day-old unanswered gate should have gone stale")
	}
}

func TestValidateReleaseEarlyNeedsReflection(t *testing.T) {
	s := Session{StartedAt: now, EndsAt: now.Add(15 * time.Minute)}
	early, err := ValidateRelease(s, Release{ReturnRule: RuleOneTrade}, now.Add(time.Minute))
	if err == nil || !early {
		t.Fatalf("early release without reflection should fail (early=%v err=%v)", early, err)
	}
	long := strings.Repeat("I am chasing the loss and I know it. ", 2)
	early, err = ValidateRelease(s, Release{ReturnRule: RuleOneTrade, Reflection: long}, now.Add(time.Minute))
	if err != nil || !early {
		t.Fatalf("early release with reflection should pass (early=%v err=%v)", early, err)
	}
	early, err = ValidateRelease(s, Release{ReturnRule: RuleNone}, now.Add(16*time.Minute))
	if err != nil || early {
		t.Fatalf("on-time release needs no reflection (early=%v err=%v)", early, err)
	}
	if _, err = ValidateRelease(s, Release{ReturnRule: "yolo"}, now.Add(16*time.Minute)); err == nil {
		t.Fatal("unknown return rule should fail")
	}
	if _, err = ValidateRelease(s, Release{ReturnRule: RuleNone, Impulse: "greed"}, now.Add(16*time.Minute)); err == nil {
		t.Fatal("unknown impulse should fail")
	}
	rel := now
	s.ReleasedAt = &rel
	if _, err = ValidateRelease(s, Release{ReturnRule: RuleNone}, now.Add(16*time.Minute)); err == nil {
		t.Fatal("releasing twice should fail")
	}
}

func TestTrippedLossStreak(t *testing.T) {
	r := Rules{MaxConsecutiveLosses: 3, MaxDailyLoss: 1000}
	trades := []Trade{
		closed(7, 9, 40, 50),
		closed(7, 10, 0, -20),
		closed(7, 10, 30, -30),
		closed(7, 11, 0, -10),
	}
	if got := Tripped(r, trades, now, nyc); got != TriggerLossStreak {
		t.Fatalf("got %q, want loss_streak", got)
	}
	// A winner breaks the streak.
	trades = append(trades, closed(7, 12, 0, 5))
	if got := Tripped(r, trades, now, nyc); got != "" {
		t.Fatalf("got %q, want nothing", got)
	}
	// Yesterday's streak doesn't count today.
	old := []Trade{closed(6, 10, 0, -20), closed(6, 10, 30, -30), closed(6, 11, 0, -10)}
	if got := Tripped(r, old, now, nyc); got != "" {
		t.Fatalf("got %q, want nothing for yesterday", got)
	}
}

func TestTrippedDailyLossAndTradeCap(t *testing.T) {
	r := Rules{MaxDailyLoss: 100}
	trades := []Trade{closed(7, 10, 0, -80), closed(7, 10, 30, -40), closed(7, 11, 0, 200)}
	if got := Tripped(r, trades, now, nyc); got != TriggerDailyLoss {
		t.Fatalf("intraday dip should trip daily loss, got %q", got)
	}
	r = Rules{MaxTradesPerDay: 2}
	if got := Tripped(r, trades, now, nyc); got != TriggerTradeLimit {
		t.Fatalf("3 trades over a cap of 2 should trip, got %q", got)
	}
	if got := Tripped(Rules{}, trades, now, nyc); got != "" {
		t.Fatalf("no rules should trip nothing, got %q", got)
	}
}

func TestComputeAfterReleaseAndBreaches(t *testing.T) {
	rel := at(7, 11, 0)
	sessions := []Session{
		{StartedAt: at(7, 10, 45), EndsAt: at(7, 11, 0), Trigger: TriggerLossStreak,
			Impulse: ImpulseRevenge, ReleasedAt: &rel, ReturnRule: RuleOneTrade},
		{StartedAt: at(5, 10, 0), EndsAt: at(5, 10, 5), Trigger: TriggerManual}, // never released, day 5
	}
	trades := []Trade{
		// Day 6: three losses in a row with no cooldown, then a revenge trade.
		closed(6, 9, 40, -10), closed(6, 10, 0, -10), closed(6, 10, 20, -10),
		{NetPnl: -50, OpenedAt: at(6, 10, 30), ClosedAt: at(6, 10, 50)},
		// Day 7: after the release, one allowed trade then a breach.
		{NetPnl: 40, OpenedAt: at(7, 11, 10), ClosedAt: at(7, 11, 30)},
		{NetPnl: -20, OpenedAt: at(7, 11, 40), ClosedAt: at(7, 12, 0)},
		// Opened long after the window: counted for the rule, not the window.
		{NetPnl: 10, OpenedAt: at(7, 14, 0), ClosedAt: at(7, 14, 30)},
	}
	st := Compute(sessions, trades, 3, 100, nyc)
	if st.Sessions != 2 || st.Released != 1 || st.EarlyReleases != 0 {
		t.Fatalf("sessions=%d released=%d early=%d", st.Sessions, st.Released, st.EarlyReleases)
	}
	if st.ByTrigger[TriggerLossStreak] != 1 || st.ByImpulse[ImpulseRevenge] != 1 || st.ByRule[RuleOneTrade] != 1 {
		t.Fatalf("breakdowns: %+v %+v %+v", st.ByTrigger, st.ByImpulse, st.ByRule)
	}
	if st.AfterRelease.Trades != 2 || st.AfterRelease.NetPnl != 20 || st.AfterRelease.WinRate != 0.5 {
		t.Fatalf("after release: %+v", st.AfterRelease)
	}
	if st.ReturnRuleBreaches != 2 {
		t.Fatalf("one_trade with three trades after = 2 breaches, got %d", st.ReturnRuleBreaches)
	}
	if st.AfterStreakNoCooldown.Trades != 1 || st.AfterStreakNoCooldown.NetPnl != -50 {
		t.Fatalf("counterfactual: %+v", st.AfterStreakNoCooldown)
	}
	if st.AvgMinutes != 15 {
		t.Fatalf("avg minutes = %v, want 15", st.AvgMinutes)
	}
}

func TestComputeDayWithCooldownIsNotCounterfactual(t *testing.T) {
	sessions := []Session{{StartedAt: at(7, 10, 30), EndsAt: at(7, 10, 45), Trigger: TriggerManual}}
	trades := []Trade{
		closed(7, 9, 40, -10), closed(7, 10, 0, -10), closed(7, 10, 20, -10),
		{NetPnl: -50, OpenedAt: at(7, 10, 25), ClosedAt: at(7, 10, 50)},
	}
	st := Compute(sessions, trades, 3, 0, nyc)
	if st.AfterStreakNoCooldown.Trades != 0 {
		t.Fatalf("a day with a cooldown must not feed the no-cooldown baseline: %+v", st.AfterStreakNoCooldown)
	}
}

func TestComputeHalfSizeBreach(t *testing.T) {
	rel := at(7, 11, 0)
	sessions := []Session{{StartedAt: at(7, 10, 45), EndsAt: rel, ReleasedAt: &rel, ReturnRule: RuleHalfSize, ReleasedEarly: true}}
	trades := []Trade{
		{NetPnl: 5, OpenedAt: at(7, 11, 5), ClosedAt: at(7, 11, 20), InitialRisk: 40},
		{NetPnl: 5, OpenedAt: at(7, 11, 30), ClosedAt: at(7, 11, 50), InitialRisk: 80},
	}
	st := Compute(sessions, trades, 0, 100, nyc)
	if st.ReturnRuleBreaches != 1 {
		t.Fatalf("risk 80 against half of 100 is one breach, got %d", st.ReturnRuleBreaches)
	}
	if st.EarlyReleaseRate != 1 {
		t.Fatalf("early release rate = %v, want 1", st.EarlyReleaseRate)
	}
	if st.StreakN != 3 {
		t.Fatalf("streakN defaults to 3, got %d", st.StreakN)
	}
	// Unscorable without a max risk.
	if got := Compute(sessions, trades, 0, 0, nyc).ReturnRuleBreaches; got != 0 {
		t.Fatalf("half_size without max risk is unscorable, got %d", got)
	}
}
