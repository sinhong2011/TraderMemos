// Package cooldown models the timed pause a trader takes before trading
// again — the circuit breaker that interrupts revenge trading, FOMO chasing
// and oversizing after a bad run. A session counts down, then a return gate
// (name the impulse, pick the one setup allowed, commit to a return rule) has
// to be answered before the trader is unlocked. Unlocking before the timer
// ends is allowed, but only with a written reflection: the typing is the
// friction.
//
// Sessions can start by hand or be handed to the trader by a tripped risk
// rule (loss streak, daily loss, trade cap) — the journal already knows the
// trader just took three losses, so it doesn't wait to be asked.
package cooldown

import (
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

// Triggers record what started a session.
const (
	TriggerManual     = "manual"
	TriggerLossStreak = "loss_streak"
	TriggerDailyLoss  = "daily_loss"
	TriggerTradeLimit = "trade_limit"
)

// Impulses are the urges a trader names at the gate.
const (
	ImpulseRevenge    = "revenge"
	ImpulseFomo       = "fomo"
	ImpulseBoredom    = "boredom"
	ImpulseFear       = "fear"
	ImpulseValidation = "validation"
)

// Return rules are the commitment made on the way back in. They are scored
// afterwards (Stats, analytics.Compliance) so the promise has consequences.
const (
	RuleNone       = "none"
	RuleHalfSize   = "half_size"
	RuleOneTrade   = "one_trade"
	RuleDoneForDay = "done_for_day"
)

// Phases of a session.
const (
	PhaseCounting = "counting" // timer running
	PhaseGate     = "gate"     // timer done, return gate unanswered
	PhaseReleased = "released"
)

const (
	MinDuration = time.Minute
	MaxDuration = 24 * time.Hour
	// StaleAfter bounds how long an unanswered gate keeps the trader locked:
	// a session nobody came back to expires quietly rather than locking the
	// app forever.
	StaleAfter = 24 * time.Hour
	// MinReflection is the shortest reflection accepted for an early release.
	MinReflection = 40
	// ReturnWindow is how long after a release (or a loss streak) trades are
	// attributed to that moment for the before/after comparison.
	ReturnWindow = 60 * time.Minute
)

var (
	triggers = []string{TriggerManual, TriggerLossStreak, TriggerDailyLoss, TriggerTradeLimit}
	impulses = []string{ImpulseRevenge, ImpulseFomo, ImpulseBoredom, ImpulseFear, ImpulseValidation}
	rules    = []string{RuleNone, RuleHalfSize, RuleOneTrade, RuleDoneForDay}
)

// ValidTrigger reports whether s names a known trigger.
func ValidTrigger(s string) bool { return slices.Contains(triggers, s) }

// ValidImpulse reports whether s names a known impulse ("" = not named).
func ValidImpulse(s string) bool { return s == "" || slices.Contains(impulses, s) }

// ValidRule reports whether s names a known return rule.
func ValidRule(s string) bool { return slices.Contains(rules, s) }

// Session is the engine-neutral view of one cooldown.
type Session struct {
	ID            string
	StartedAt     time.Time
	EndsAt        time.Time
	Trigger       string
	Impulse       string
	ReleasedAt    *time.Time
	ReleasedEarly bool
	SetupID       string
	ReturnRule    string
	Reflection    string
}

// Phase derives the session's state at now.
func (s Session) Phase(now time.Time) string {
	switch {
	case s.ReleasedAt != nil:
		return PhaseReleased
	case now.Before(s.EndsAt):
		return PhaseCounting
	default:
		return PhaseGate
	}
}

// Open reports whether the session still locks the trader at now: not
// released, and not so old it has gone stale.
func (s Session) Open(now time.Time) bool {
	return s.ReleasedAt == nil && now.Sub(s.StartedAt) < StaleAfter
}

// Release is the return-gate answer.
type Release struct {
	Impulse    string
	SetupID    string
	ReturnRule string
	Reflection string
}

// ValidateRelease checks a gate answer against the session at now and
// reports whether it is an early release. Early releases need a reflection
// of at least MinReflection characters.
func ValidateRelease(s Session, r Release, now time.Time) (early bool, err error) {
	if s.ReleasedAt != nil {
		return false, errors.New("cooldown already released")
	}
	if !ValidImpulse(r.Impulse) {
		return false, fmt.Errorf("unknown impulse %q", r.Impulse)
	}
	if !ValidRule(r.ReturnRule) {
		return false, fmt.Errorf("unknown return_rule %q", r.ReturnRule)
	}
	early = now.Before(s.EndsAt)
	if early && utf8.RuneCountInString(strings.TrimSpace(r.Reflection)) < MinReflection {
		return true, fmt.Errorf("releasing early needs a reflection of at least %d characters", MinReflection)
	}
	return early, nil
}

// Rules are the risk-rule thresholds that can hand the trader a cooldown.
// Zero values mean the rule is not set.
type Rules struct {
	CooldownMinutes      int
	MaxDailyLoss         float64 // positive magnitude
	MaxTradesPerDay      int
	MaxConsecutiveLosses int
	MaxRiskPerTrade      float64
}

// Trade is the closed-trade view the evaluator and the stats need.
type Trade struct {
	NetPnl      float64
	OpenedAt    time.Time
	ClosedAt    time.Time
	InitialRisk float64 // 0 = not recorded
}

// Tripped reports which rule today's trades have tripped, or "" when none
// has. Days are bucketed in loc. Loss streak wins over daily loss over the
// trade cap when several trip at once — it is the most specific signal.
func Tripped(r Rules, trades []Trade, now time.Time, loc *time.Location) string {
	if loc == nil {
		loc = time.UTC
	}
	today := now.In(loc).Format("2006-01-02")
	var todays []Trade
	for _, t := range trades {
		if t.ClosedAt.In(loc).Format("2006-01-02") == today {
			todays = append(todays, t)
		}
	}
	if len(todays) == 0 {
		return ""
	}
	sort.SliceStable(todays, func(i, j int) bool { return todays[i].ClosedAt.Before(todays[j].ClosedAt) })

	if r.MaxConsecutiveLosses > 0 {
		streak := 0
		for _, t := range slices.Backward(todays) {
			if t.NetPnl >= 0 {
				break
			}
			streak++
		}
		if streak >= r.MaxConsecutiveLosses {
			return TriggerLossStreak
		}
	}
	if r.MaxDailyLoss > 0 {
		var running, low float64
		for _, t := range todays {
			running += t.NetPnl
			low = min(low, running)
		}
		if low < -r.MaxDailyLoss {
			return TriggerDailyLoss
		}
	}
	if r.MaxTradesPerDay > 0 && len(todays) >= r.MaxTradesPerDay {
		return TriggerTradeLimit
	}
	return ""
}

// WindowStats summarizes the trades taken inside an attribution window.
type WindowStats struct {
	Trades  int     `json:"trades"`
	Wins    int     `json:"wins"`
	NetPnl  float64 `json:"net_pnl"`
	WinRate float64 `json:"win_rate"` // 0–1, 0 when no trades
}

func (w *WindowStats) add(t Trade) {
	w.Trades++
	w.NetPnl += t.NetPnl
	if t.NetPnl > 0 {
		w.Wins++
	}
}

func (w *WindowStats) finish() {
	if w.Trades > 0 {
		w.WinRate = float64(w.Wins) / float64(w.Trades)
	}
}

// Stats is the payload for GET /analytics/cooldowns.
type Stats struct {
	Sessions         int            `json:"sessions"`
	Released         int            `json:"released"`
	EarlyReleases    int            `json:"early_releases"`
	EarlyReleaseRate float64        `json:"early_release_rate"` // of released sessions
	AvgMinutes       float64        `json:"avg_minutes"`
	ByTrigger        map[string]int `json:"by_trigger"`
	ByImpulse        map[string]int `json:"by_impulse"`
	ByRule           map[string]int `json:"by_rule"`
	// AfterRelease covers trades opened within ReturnWindow of a release.
	AfterRelease WindowStats `json:"after_release"`
	// AfterStreakNoCooldown covers trades opened within ReturnWindow of a
	// StreakN-loss streak on days with no cooldown — the counterfactual.
	AfterStreakNoCooldown WindowStats `json:"after_streak_no_cooldown"`
	StreakN               int         `json:"streak_n"`
	// ReturnRuleBreaches counts trades taken against a return rule on the
	// day it was made.
	ReturnRuleBreaches int `json:"return_rule_breaches"`
}

// Compute summarizes the sessions and scores the trades around them. streakN
// is the loss streak used for the no-cooldown comparison (the user's
// max_consecutive_losses, or 3 when unset); maxRisk is max_risk_per_trade
// for scoring half_size commitments (0 = can't score).
func Compute(sessions []Session, trades []Trade, streakN int, maxRisk float64, loc *time.Location) Stats {
	if loc == nil {
		loc = time.UTC
	}
	if streakN <= 0 {
		streakN = 3
	}
	st := Stats{
		ByTrigger: map[string]int{},
		ByImpulse: map[string]int{},
		ByRule:    map[string]int{},
		StreakN:   streakN,
	}
	sorted := make([]Trade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })

	cooldownDays := map[string]bool{}
	var totalMinutes float64
	for _, s := range sessions {
		st.Sessions++
		st.ByTrigger[s.Trigger]++
		if s.Impulse != "" {
			st.ByImpulse[s.Impulse]++
		}
		cooldownDays[s.StartedAt.In(loc).Format("2006-01-02")] = true
		if s.ReleasedAt == nil {
			continue
		}
		st.Released++
		if s.ReleasedEarly {
			st.EarlyReleases++
		}
		if s.ReturnRule != "" && s.ReturnRule != RuleNone {
			st.ByRule[s.ReturnRule]++
		}
		totalMinutes += s.ReleasedAt.Sub(s.StartedAt).Minutes()

		rel := *s.ReleasedAt
		relDay := rel.In(loc).Format("2006-01-02")
		taken := 0
		for _, t := range sorted {
			if !t.OpenedAt.After(rel) {
				continue
			}
			if t.OpenedAt.Sub(rel) <= ReturnWindow {
				st.AfterRelease.add(t)
			}
			if t.OpenedAt.In(loc).Format("2006-01-02") != relDay {
				continue
			}
			taken++
			switch s.ReturnRule {
			case RuleDoneForDay:
				st.ReturnRuleBreaches++
			case RuleOneTrade:
				if taken > 1 {
					st.ReturnRuleBreaches++
				}
			case RuleHalfSize:
				if maxRisk > 0 && t.InitialRisk > maxRisk/2 {
					st.ReturnRuleBreaches++
				}
			}
		}
	}
	if st.Released > 0 {
		st.EarlyReleaseRate = float64(st.EarlyReleases) / float64(st.Released)
		st.AvgMinutes = totalMinutes / float64(st.Released)
	}

	// Counterfactual: the trades taken right after a loss streak on days the
	// trader did not cool down. Each trade counts once even if several
	// streak moments cover it.
	counted := map[int]bool{}
	streak := 0
	lastDay := ""
	for i, t := range sorted {
		day := t.ClosedAt.In(loc).Format("2006-01-02")
		if day != lastDay {
			streak = 0
			lastDay = day
		}
		if t.NetPnl < 0 {
			streak++
		} else {
			streak = 0
		}
		if streak < streakN || cooldownDays[day] {
			continue
		}
		for j := i + 1; j < len(sorted); j++ {
			n := sorted[j]
			if !n.OpenedAt.After(t.ClosedAt) || n.OpenedAt.Sub(t.ClosedAt) > ReturnWindow {
				continue
			}
			if !counted[j] {
				counted[j] = true
				st.AfterStreakNoCooldown.add(n)
			}
		}
	}
	st.AfterRelease.finish()
	st.AfterStreakNoCooldown.finish()
	return st
}
