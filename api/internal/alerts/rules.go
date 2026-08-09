// Package alerts evaluates journal rules against a user's trading data and
// delivers notifications through the user's configured channels (Expo push,
// outgoing webhooks). Evaluation runs after trade writes and on a schedule;
// the alert_events table's unique (user, rule, dedupe_key) index is what keeps
// either path from re-sending a notification.
package alerts

import (
	"fmt"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/prop"
)

// Rule identifiers, stored in alert_events.rule.
const (
	RuleRisk         = "risk_rule"
	RuleDailyLoss    = "daily_loss"
	RuleLossStreak   = "loss_streak"
	RulePropDrawdown = "prop_drawdown"
	RuleUnreviewed   = "unreviewed"
	RuleTest         = "test"
)

// riskWindow bounds how far back the per-trade risk rule looks, so importing
// months of history doesn't flood the channels with stale violations.
const riskWindow = 72 * time.Hour

// Trade is the closed-trade view the evaluator needs.
type Trade struct {
	ID          string
	Symbol      string
	NetPnl      float64
	ClosedAt    time.Time
	InitialRisk float64 // 0 = not recorded
}

// Config holds the enabled rules and their thresholds. Zero thresholds mean
// the rule has nothing to compare against and stays silent.
type Config struct {
	RiskEnabled       bool
	MaxRiskPerTrade   float64 // from risk_rules
	DailyLossEnabled  bool
	MaxDailyLoss      float64 // from risk_rules, positive magnitude
	LossStreakEnabled bool
	LossStreakN       int
	PropEnabled       bool
	PropWarnPct       float64 // fraction of the drawdown budget consumed (0–1)
	UnreviewedEnabled bool
	UnreviewedDays    int
}

// Event is one fired alert. DedupeKey scopes how often the rule may re-fire:
// per trade, per day, or per week depending on the rule.
type Event struct {
	Rule      string
	DedupeKey string
	Title     string
	Body      string
}

// Evaluate runs the trade-based rules (risk per trade, daily loss, loss
// streak) over the user's closed trades. Days are bucketed in loc.
func Evaluate(cfg Config, trades []Trade, now time.Time, loc *time.Location) []Event {
	if loc == nil {
		loc = time.UTC
	}
	sorted := make([]Trade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })
	today := now.In(loc).Format("2006-01-02")

	var evs []Event
	if cfg.RiskEnabled && cfg.MaxRiskPerTrade > 0 {
		for _, t := range sorted {
			if t.InitialRisk > cfg.MaxRiskPerTrade && now.Sub(t.ClosedAt) <= riskWindow {
				evs = append(evs, Event{
					Rule:      RuleRisk,
					DedupeKey: t.ID,
					Title:     "Risk rule broken",
					Body: fmt.Sprintf("%s risked %.2f — your max risk per trade is %.2f.",
						t.Symbol, t.InitialRisk, cfg.MaxRiskPerTrade),
				})
			}
		}
	}

	if cfg.DailyLossEnabled && cfg.MaxDailyLoss > 0 {
		// Running low of today's realized P&L: dipping below the limit counts
		// even if later winners pull the day back above it.
		var running, low float64
		for _, t := range sorted {
			if t.ClosedAt.In(loc).Format("2006-01-02") != today {
				continue
			}
			running += t.NetPnl
			if running < low {
				low = running
			}
		}
		if low < -cfg.MaxDailyLoss {
			evs = append(evs, Event{
				Rule:      RuleDailyLoss,
				DedupeKey: today,
				Title:     "Daily loss limit hit",
				Body: fmt.Sprintf("Realized P&L reached %.2f today — your daily loss limit is %.2f.",
					low, cfg.MaxDailyLoss),
			})
		}
	}

	if cfg.LossStreakEnabled && cfg.LossStreakN > 0 && len(sorted) > 0 {
		streak := 0
		for i := len(sorted) - 1; i >= 0; i-- {
			if sorted[i].NetPnl >= 0 {
				break
			}
			streak++
		}
		last := sorted[len(sorted)-1]
		if streak >= cfg.LossStreakN && last.ClosedAt.In(loc).Format("2006-01-02") == today {
			evs = append(evs, Event{
				Rule:      RuleLossStreak,
				DedupeKey: today,
				Title:     fmt.Sprintf("%d losses in a row", streak),
				Body:      fmt.Sprintf("Your last %d trades all closed at a loss. Consider stepping back.", streak),
			})
		}
	}
	return evs
}

// EvaluateProp turns a prop account's evaluated status into drawdown alerts:
// a one-time breach alert when equity touches the floor, or a once-per-day
// warning while the account has consumed warnPct of its drawdown budget.
func EvaluateProp(accountID, accountName string, st prop.Status, warnPct float64, today string) []Event {
	if st.MaxDrawdown <= 0 {
		return nil
	}
	if st.DrawdownHit {
		return []Event{{
			Rule:      RulePropDrawdown,
			DedupeKey: accountID + "|hit",
			Title:     "Prop drawdown breached",
			Body:      fmt.Sprintf("%s touched its equity floor (%.2f).", accountName, st.EquityFloor),
		}}
	}
	used := 1 - st.FloorDistance/st.MaxDrawdown
	if warnPct > 0 && used >= warnPct {
		return []Event{{
			Rule:      RulePropDrawdown,
			DedupeKey: accountID + "|" + today,
			Title:     "Prop drawdown approaching",
			Body: fmt.Sprintf("%s has used %.0f%% of its drawdown — %.2f left to the floor.",
				accountName, used*100, st.FloorDistance),
		}}
	}
	return nil
}

// Unreviewed builds the once-per-week nag about closed trades that never got
// a journal entry.
func Unreviewed(count int, olderThanDays int, now time.Time, loc *time.Location) []Event {
	if count <= 0 {
		return nil
	}
	if loc == nil {
		loc = time.UTC
	}
	year, week := now.In(loc).ISOWeek()
	noun := "trades"
	if count == 1 {
		noun = "trade"
	}
	return []Event{{
		Rule:      RuleUnreviewed,
		DedupeKey: fmt.Sprintf("%d-W%02d", year, week),
		Title:     "Unreviewed trades piling up",
		Body:      fmt.Sprintf("%d closed %s older than %d days have no journal notes.", count, noun, olderThanDays),
	}}
}
