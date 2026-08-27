package analytics

import (
	"sort"
	"time"
)

// ComplianceTrade is the per-trade view needed to score rule adherence.
type ComplianceTrade struct {
	NetPnl      float64
	OpenedAt    time.Time // zero = unknown; ClosedAt stands in
	ClosedAt    time.Time
	InitialRisk float64 // 0 = not recorded
}

// ReturnCommitment is the return rule a trader made on the way out of a
// cooldown: from At on, that day's trades are held to Rule. Rule values
// mirror the cooldown package — "half_size", "one_trade", "done_for_day".
type ReturnCommitment struct {
	At   time.Time
	Rule string
}

// ComplianceRules are the enforceable subset of the user's risk rules.
// Zero values mean the rule is not configured.
type ComplianceRules struct {
	MaxRiskPerTrade float64
	MaxDailyLoss    float64 // positive magnitude
	MaxTradesPerDay int
	// Stop after this many losing closes in a row within a day.
	MaxConsecutiveLosses int
	// Commitments are scored on top of the standing rules.
	Commitments []ReturnCommitment
}

func (r ComplianceRules) configured() bool {
	return r.MaxRiskPerTrade > 0 || r.MaxDailyLoss > 0 || r.MaxTradesPerDay > 0 ||
		r.MaxConsecutiveLosses > 0 || len(r.Commitments) > 0
}

// ComplianceDay scores one calendar day against the rules.
type ComplianceDay struct {
	Date             string  `json:"date"` // YYYY-MM-DD in the trader's timezone
	NetPnl           float64 `json:"net_pnl"`
	Trades           int     `json:"trades"`
	RiskViolations   int     `json:"risk_violations"`
	UnknownRisk      int     `json:"unknown_risk"`
	DailyLossBreach  bool    `json:"daily_loss_breach"`
	TradeLimitBreach bool    `json:"trade_limit_breach"`
	LossStreakBreach bool    `json:"loss_streak_breach"`
	ReturnRuleBreach bool    `json:"return_rule_breach"`
	Compliant        bool    `json:"compliant"`
}

// ComplianceReport is the payload for GET /analytics/compliance.
type ComplianceReport struct {
	RulesConfigured    bool            `json:"rules_configured"`
	Days               []ComplianceDay `json:"days"`
	CompliantDays      int             `json:"compliant_days"`
	BreachDays         int             `json:"breach_days"`
	CompliantPnl       float64         `json:"compliant_pnl"`
	BreachPnl          float64         `json:"breach_pnl"`
	RiskViolations     int             `json:"risk_violations"`
	UnknownRisk        int             `json:"unknown_risk"`
	DailyLossBreaches  int             `json:"daily_loss_breaches"`
	TradeLimitBreaches int             `json:"trade_limit_breaches"`
	LossStreakBreaches int             `json:"loss_streak_breaches"`
	// ReturnRuleBreaches counts trades taken against a cooldown return rule.
	ReturnRuleBreaches int `json:"return_rule_breaches"`
}

// Compliance scores closed trades against the rules, day by day in loc.
//
// A day breaches the daily-loss rule when its *running* realized P&L (trades
// ordered by close time) dips below −MaxDailyLoss at any point — finishing
// green after blowing through the limit still counts as a breach. A trade
// violates the risk rule when its recorded initial risk exceeds
// MaxRiskPerTrade; trades with no recorded risk are reported separately
// rather than silently passed or failed. A day breaches the trade-count rule
// when more than MaxTradesPerDay trades close in it, and the loss-streak rule
// when a trade closes after the day already held MaxConsecutiveLosses losing
// closes in a row — the rule is "stop trading", so the breach is the trade
// taken past the stop, whatever that trade's own result.
//
// A return commitment is scored the same way, on the trades opened after it
// on its day: "done_for_day" is broken by any trade, "one_trade" by the
// second, and "half_size" by a trade risking more than half MaxRiskPerTrade
// (unscorable when that rule is unset or the risk was never recorded).
func Compliance(trades []ComplianceTrade, rules ComplianceRules, loc *time.Location) ComplianceReport {
	rep := ComplianceReport{RulesConfigured: rules.configured(), Days: []ComplianceDay{}}
	if !rep.RulesConfigured || len(trades) == 0 {
		return rep
	}
	if loc == nil {
		loc = time.UTC
	}

	sorted := make([]ComplianceTrade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })

	byDay := make(map[string]*ComplianceDay)
	running := make(map[string]float64)
	// Consecutive losing closes so far in each day.
	streak := make(map[string]int)
	// Trades opened after each commitment on its day, by commitment index.
	taken := make(map[int]int)
	var order []string
	for _, t := range sorted {
		key := t.ClosedAt.In(loc).Format("2006-01-02")
		openedAt := t.OpenedAt
		if openedAt.IsZero() {
			openedAt = t.ClosedAt
		}
		d, ok := byDay[key]
		if !ok {
			d = &ComplianceDay{Date: key}
			byDay[key] = d
			order = append(order, key)
		}
		d.Trades++
		d.NetPnl += t.NetPnl
		if rules.MaxTradesPerDay > 0 && d.Trades > rules.MaxTradesPerDay {
			d.TradeLimitBreach = true
		}
		if rules.MaxConsecutiveLosses > 0 {
			// Checked before this trade updates the streak: the violation is
			// closing another trade when the stop was already due.
			if streak[key] >= rules.MaxConsecutiveLosses {
				d.LossStreakBreach = true
			}
			if t.NetPnl < 0 {
				streak[key]++
			} else {
				streak[key] = 0
			}
		}
		if rules.MaxRiskPerTrade > 0 {
			switch {
			case t.InitialRisk <= 0:
				d.UnknownRisk++
			case t.InitialRisk > rules.MaxRiskPerTrade:
				d.RiskViolations++
			}
		}
		if rules.MaxDailyLoss > 0 {
			running[key] += t.NetPnl
			if running[key] < -rules.MaxDailyLoss {
				d.DailyLossBreach = true
			}
		}
		for i, cm := range rules.Commitments {
			if !openedAt.After(cm.At) || cm.At.In(loc).Format("2006-01-02") != key {
				continue
			}
			taken[i]++
			breach := false
			switch cm.Rule {
			case "done_for_day":
				breach = true
			case "one_trade":
				breach = taken[i] > 1
			case "half_size":
				breach = rules.MaxRiskPerTrade > 0 && t.InitialRisk > rules.MaxRiskPerTrade/2
			}
			if breach {
				d.ReturnRuleBreach = true
				rep.ReturnRuleBreaches++
			}
		}
	}

	for _, key := range order {
		d := byDay[key]
		d.Compliant = d.RiskViolations == 0 && !d.DailyLossBreach && !d.TradeLimitBreach &&
			!d.LossStreakBreach && !d.ReturnRuleBreach
		rep.Days = append(rep.Days, *d)
		rep.RiskViolations += d.RiskViolations
		rep.UnknownRisk += d.UnknownRisk
		if d.DailyLossBreach {
			rep.DailyLossBreaches++
		}
		if d.TradeLimitBreach {
			rep.TradeLimitBreaches++
		}
		if d.LossStreakBreach {
			rep.LossStreakBreaches++
		}
		if d.Compliant {
			rep.CompliantDays++
			rep.CompliantPnl += d.NetPnl
		} else {
			rep.BreachDays++
			rep.BreachPnl += d.NetPnl
		}
	}
	return rep
}
