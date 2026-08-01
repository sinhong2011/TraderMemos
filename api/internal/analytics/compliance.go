package analytics

import (
	"sort"
	"time"
)

// ComplianceTrade is the per-trade view needed to score rule adherence.
type ComplianceTrade struct {
	NetPnl      float64
	ClosedAt    time.Time
	InitialRisk float64 // 0 = not recorded
}

// ComplianceRules are the enforceable subset of the user's risk rules.
// Zero values mean the rule is not configured.
type ComplianceRules struct {
	MaxRiskPerTrade float64
	MaxDailyLoss    float64 // positive magnitude
}

func (r ComplianceRules) configured() bool {
	return r.MaxRiskPerTrade > 0 || r.MaxDailyLoss > 0
}

// ComplianceDay scores one calendar day against the rules.
type ComplianceDay struct {
	Date            string  `json:"date"` // YYYY-MM-DD in the trader's timezone
	NetPnl          float64 `json:"net_pnl"`
	Trades          int     `json:"trades"`
	RiskViolations  int     `json:"risk_violations"`
	UnknownRisk     int     `json:"unknown_risk"`
	DailyLossBreach bool    `json:"daily_loss_breach"`
	Compliant       bool    `json:"compliant"`
}

// ComplianceReport is the payload for GET /analytics/compliance.
type ComplianceReport struct {
	RulesConfigured   bool            `json:"rules_configured"`
	Days              []ComplianceDay `json:"days"`
	CompliantDays     int             `json:"compliant_days"`
	BreachDays        int             `json:"breach_days"`
	CompliantPnl      float64         `json:"compliant_pnl"`
	BreachPnl         float64         `json:"breach_pnl"`
	RiskViolations    int             `json:"risk_violations"`
	UnknownRisk       int             `json:"unknown_risk"`
	DailyLossBreaches int             `json:"daily_loss_breaches"`
}

// Compliance scores closed trades against the rules, day by day in loc.
//
// A day breaches the daily-loss rule when its *running* realized P&L (trades
// ordered by close time) dips below −MaxDailyLoss at any point — finishing
// green after blowing through the limit still counts as a breach. A trade
// violates the risk rule when its recorded initial risk exceeds
// MaxRiskPerTrade; trades with no recorded risk are reported separately
// rather than silently passed or failed.
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
	var order []string
	for _, t := range sorted {
		key := t.ClosedAt.In(loc).Format("2006-01-02")
		d, ok := byDay[key]
		if !ok {
			d = &ComplianceDay{Date: key}
			byDay[key] = d
			order = append(order, key)
		}
		d.Trades++
		d.NetPnl += t.NetPnl
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
	}

	for _, key := range order {
		d := byDay[key]
		d.Compliant = d.RiskViolations == 0 && !d.DailyLossBreach
		rep.Days = append(rep.Days, *d)
		rep.RiskViolations += d.RiskViolations
		rep.UnknownRisk += d.UnknownRisk
		if d.DailyLossBreach {
			rep.DailyLossBreaches++
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
