package analytics

import (
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

// Mistake source kinds.
const (
	MistakeKindTag      = "tag"      // a mistake tag the trader applied
	MistakeKindRule     = "rule"     // a risk rule the trade broke
	MistakeKindBehavior = "behavior" // a detected revenge / overconfidence trade
)

// MistakeSource is one reason a trade counts as a mistake.
type MistakeSource struct {
	Key   string // stable id, e.g. "tag:<id>", "rule:over_max_risk"
	Kind  string
	Label string
}

// TaxTrade is a closed trade as the mistake tax sees it.
type TaxTrade struct {
	ID          string
	NetPnl      float64
	InitialRisk float64 // 0 when not recorded
	ClosedAt    time.Time
	Reviewed    bool // has a note — a loser with neither note nor flag is "unreviewed"
}

// MistakeSourceRow totals one source. A trade with several sources counts in
// full under each, so rows can sum to more than MistakeTax.TotalCost.
type MistakeSourceRow struct {
	Key      string   `json:"key"`
	Kind     string   `json:"kind"`
	Label    string   `json:"label"`
	Trades   int      `json:"trades"`
	Cost     float64  `json:"cost"`     // Σ losses, positive
	CostR    float64  `json:"cost_r"`   // Σ losses in R over trades with risk
	RTrades  int      `json:"r_trades"` // trades CostR covers
	Lucky    float64  `json:"lucky"`    // Σ wins on these trades ("won anyway")
	TradeIDs []string `json:"trade_ids"`
}

// MistakePeriod is the tax for one week or month.
type MistakePeriod struct {
	Period string  `json:"period"` // week start (YYYY-MM-DD) or month (YYYY-MM)
	Cost   float64 `json:"cost"`
}

// MistakeTaxReport is the payload for GET /analytics/mistake-tax.
type MistakeTaxReport struct {
	PeriodNet        float64            `json:"period_net"`
	GrossLoss        float64            `json:"gross_loss"` // Σ losses, all trades, positive
	TotalCost        float64            `json:"total_cost"` // each flagged trade once
	TotalCostR       float64            `json:"total_cost_r"`
	RTrades          int                `json:"r_trades"` // flagged trades with risk
	FlaggedTrades    int                `json:"flagged_trades"`
	ShareOfLosses    float64            `json:"share_of_losses"`
	LuckyWins        float64            `json:"lucky_wins"`
	NetWithout       float64            `json:"net_without"` // period net minus flagged trades' net
	Sources          []MistakeSourceRow `json:"sources"`
	Bucket           string             `json:"bucket"` // "week" | "month"
	Series           []MistakePeriod    `json:"series"`
	UnreviewedLosses int                `json:"unreviewed_losses"`
	UnreviewedIDs    []string           `json:"unreviewed_ids"`
}

// MistakeTax prices the trades flagged as mistakes. Cost is the loss only: a
// mistake that happened to win does not lower the tax; its profit is reported
// as LuckyWins instead. bucket is "week" or "month" (periods in loc).
func MistakeTax(trades []TaxTrade, flags map[string][]MistakeSource, bucket string, loc *time.Location) MistakeTaxReport {
	if loc == nil {
		loc = time.UTC
	}
	if bucket != "month" {
		bucket = "week"
	}
	rep := MistakeTaxReport{
		Sources:       []MistakeSourceRow{},
		Series:        []MistakePeriod{},
		Bucket:        bucket,
		UnreviewedIDs: []string{},
	}
	rows := map[string]*MistakeSourceRow{}
	series := map[string]float64{}
	var flaggedNet float64
	var first, last time.Time

	sorted := make([]TaxTrade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })

	for _, t := range sorted {
		rep.PeriodNet += t.NetPnl
		if t.NetPnl < 0 {
			rep.GrossLoss -= t.NetPnl
		}
		if first.IsZero() {
			first = t.ClosedAt
		}
		last = t.ClosedAt

		srcs := dedupeSources(flags[t.ID])
		if len(srcs) == 0 {
			if t.NetPnl < 0 && !t.Reviewed {
				rep.UnreviewedLosses++
				rep.UnreviewedIDs = append(rep.UnreviewedIDs, t.ID)
			}
			continue
		}

		cost := 0.0
		if t.NetPnl < 0 {
			cost = -t.NetPnl
		}
		var costR float64
		hasR := t.InitialRisk > 0
		if hasR && t.NetPnl < 0 {
			costR = -t.NetPnl / t.InitialRisk
		}
		lucky := 0.0
		if t.NetPnl > 0 {
			lucky = t.NetPnl
		}

		rep.FlaggedTrades++
		rep.TotalCost += cost
		rep.TotalCostR += costR
		if hasR {
			rep.RTrades++
		}
		rep.LuckyWins += lucky
		flaggedNet += t.NetPnl
		series[periodKey(t.ClosedAt, bucket, loc)] += cost

		for _, src := range srcs {
			row := rows[src.Key]
			if row == nil {
				row = &MistakeSourceRow{Key: src.Key, Kind: src.Kind, Label: src.Label, TradeIDs: []string{}}
				rows[src.Key] = row
			}
			row.Trades++
			row.Cost += cost
			row.CostR += costR
			if hasR {
				row.RTrades++
			}
			row.Lucky += lucky
			row.TradeIDs = append(row.TradeIDs, t.ID)
		}
	}

	rep.PeriodNet = money.Round2(rep.PeriodNet)
	rep.GrossLoss = money.Round2(rep.GrossLoss)
	rep.TotalCost = money.Round2(rep.TotalCost)
	rep.TotalCostR = money.Round2(rep.TotalCostR)
	rep.LuckyWins = money.Round2(rep.LuckyWins)
	rep.NetWithout = money.Round2(rep.PeriodNet - flaggedNet)
	if rep.GrossLoss > 0 {
		rep.ShareOfLosses = math.Round(rep.TotalCost/rep.GrossLoss*1e4) / 1e4
	}

	for _, row := range rows {
		row.Cost = money.Round2(row.Cost)
		row.CostR = money.Round2(row.CostR)
		row.Lucky = money.Round2(row.Lucky)
		rep.Sources = append(rep.Sources, *row)
	}
	sort.Slice(rep.Sources, func(i, j int) bool {
		a, b := rep.Sources[i], rep.Sources[j]
		if a.Cost != b.Cost {
			return a.Cost > b.Cost
		}
		if a.Trades != b.Trades {
			return a.Trades > b.Trades
		}
		return a.Label < b.Label
	})

	// Every period from the first trade to the last, so a clean week reads as 0.
	if !first.IsZero() {
		for p := periodStart(first, bucket, loc); !p.After(last.In(loc)); p = nextPeriod(p, bucket) {
			key := periodKey(p, bucket, loc)
			rep.Series = append(rep.Series, MistakePeriod{Period: key, Cost: money.Round2(series[key])})
		}
	}
	return rep
}

func dedupeSources(in []MistakeSource) []MistakeSource {
	if len(in) < 2 {
		return in
	}
	seen := map[string]bool{}
	out := make([]MistakeSource, 0, len(in))
	for _, s := range in {
		if !seen[s.Key] {
			seen[s.Key] = true
			out = append(out, s)
		}
	}
	return out
}

func periodStart(t time.Time, bucket string, loc *time.Location) time.Time {
	t = t.In(loc)
	day := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
	if bucket == "month" {
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, loc)
	}
	// Weeks start on Monday.
	offset := (int(day.Weekday()) + 6) % 7
	return day.AddDate(0, 0, -offset)
}

func nextPeriod(p time.Time, bucket string) time.Time {
	if bucket == "month" {
		return p.AddDate(0, 1, 0)
	}
	return p.AddDate(0, 0, 7)
}

func periodKey(t time.Time, bucket string, loc *time.Location) string {
	p := periodStart(t, bucket, loc)
	if bucket == "month" {
		return p.Format("2006-01")
	}
	return p.Format("2006-01-02")
}
