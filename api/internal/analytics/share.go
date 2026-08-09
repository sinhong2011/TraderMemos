package analytics

import (
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

// ShareAggregate is the payload behind a public share link. It is built by
// this dedicated serializer and never by filtering the authed handlers: no
// trade rows, account names, or user ids appear here, and absolute money
// amounts are stripped server-side unless the link's scope allows them.
type ShareAggregate struct {
	Summary    ShareSummary      `json:"summary"`
	Equity     []ShareEquityPoint `json:"equity"`
	Months     []ShareMonth      `json:"months"`
	TopSymbols []ShareSymbol     `json:"top_symbols"`

	TradingDays int `json:"trading_days"`
	GreenDays   int `json:"green_days"`
	RedDays     int `json:"red_days"`
	BestStreak  int `json:"best_streak"`
	WorstStreak int `json:"worst_streak"`

	// FirstDay/LastDay bound the shared record ("2006-01-02", market tz).
	FirstDay string `json:"first_day,omitempty"`
	LastDay  string `json:"last_day,omitempty"`

	BestDayPnl  *float64 `json:"best_day_pnl,omitempty"`
	WorstDayPnl *float64 `json:"worst_day_pnl,omitempty"`

	// ShowAmounts echoes the scope so the page knows whether money fields
	// exist or the equity curve is shape-only.
	ShowAmounts bool `json:"show_amounts"`
}

// ShareSummary carries the ratio half of Summary unconditionally; the money
// half is pointer-typed and only populated when the scope allows amounts.
type ShareSummary struct {
	TotalTrades  int     `json:"total_trades"`
	Wins         int     `json:"wins"`
	Losses       int     `json:"losses"`
	Breakeven    int     `json:"breakeven"`
	WinRate      float64 `json:"win_rate"`
	ProfitFactor float64 `json:"profit_factor"`
	KellyPct     float64 `json:"kelly_pct"`
	Sqn          float64 `json:"sqn"`

	NetPnl      *float64 `json:"net_pnl,omitempty"`
	GrossProfit *float64 `json:"gross_profit,omitempty"`
	GrossLoss   *float64 `json:"gross_loss,omitempty"`
	Expectancy  *float64 `json:"expectancy,omitempty"`
	AvgWin      *float64 `json:"avg_win,omitempty"`
	AvgLoss     *float64 `json:"avg_loss,omitempty"`
	AvgTrade    *float64 `json:"avg_trade,omitempty"`
	LargestWin  *float64 `json:"largest_win,omitempty"`
	LargestLoss *float64 `json:"largest_loss,omitempty"`
	TotalFees   *float64 `json:"total_fees,omitempty"`
}

// ShareEquityPoint is one step of cumulative net P&L. With amounts hidden the
// values are scaled so the largest magnitude is 1 — the shape survives, the
// account size does not.
type ShareEquityPoint struct {
	At    time.Time `json:"at"`
	Value float64   `json:"value"`
}

type ShareMonth struct {
	Month  string   `json:"month"` // "2006-01"
	Trades int      `json:"trades"`
	Pnl    *float64 `json:"pnl,omitempty"`
}

type ShareSymbol struct {
	Symbol string   `json:"symbol"`
	Trades int      `json:"trades"`
	Pnl    *float64 `json:"pnl,omitempty"`
}

type ShareInput struct {
	Trades   []ClosedTrade
	BySymbol map[string][]ClosedTrade
	// Loc buckets days and months (market timezone); nil = UTC.
	Loc         *time.Location
	ShowAmounts bool
}

// BuildShareAggregate condenses closed trades into the public share payload.
func BuildShareAggregate(in ShareInput) ShareAggregate {
	loc := in.Loc
	if loc == nil {
		loc = time.UTC
	}
	full := Summarize(in.Trades)
	out := ShareAggregate{ShowAmounts: in.ShowAmounts}
	out.Summary = ShareSummary{
		TotalTrades:  full.TotalTrades,
		Wins:         full.Wins,
		Losses:       full.Losses,
		Breakeven:    full.Breakeven,
		WinRate:      full.WinRate,
		ProfitFactor: full.ProfitFactor,
		KellyPct:     full.KellyPct,
		Sqn:          full.Sqn,
	}
	if in.ShowAmounts {
		out.Summary.NetPnl = fptrOf(full.NetPnl)
		out.Summary.GrossProfit = fptrOf(full.GrossProfit)
		out.Summary.GrossLoss = fptrOf(full.GrossLoss)
		out.Summary.Expectancy = fptrOf(full.Expectancy)
		out.Summary.AvgWin = fptrOf(full.AvgWin)
		out.Summary.AvgLoss = fptrOf(full.AvgLoss)
		out.Summary.AvgTrade = fptrOf(full.AvgTrade)
		out.Summary.LargestWin = fptrOf(full.LargestWin)
		out.Summary.LargestLoss = fptrOf(full.LargestLoss)
		out.Summary.TotalFees = fptrOf(full.TotalFees)
	}

	out.Equity = shareEquity(in.Trades, in.ShowAmounts)
	out.Months = shareMonths(in.Trades, loc, in.ShowAmounts)
	out.TopSymbols = shareTopSymbols(in.BySymbol, in.ShowAmounts)

	daily := DailyPnl(in.Trades, "", loc)
	days := make([]string, 0, len(daily))
	for d := range daily {
		days = append(days, d)
	}
	sort.Strings(days)
	out.TradingDays = len(days)
	if len(days) > 0 {
		out.FirstDay = days[0]
		out.LastDay = days[len(days)-1]
	}
	var bestPnl, worstPnl float64
	greenRun, redRun := 0, 0
	for _, d := range days {
		pnl := daily[d]
		switch {
		case pnl > 0:
			out.GreenDays++
			greenRun++
			redRun = 0
		case pnl < 0:
			out.RedDays++
			redRun++
			greenRun = 0
		default:
			greenRun, redRun = 0, 0
		}
		if greenRun > out.BestStreak {
			out.BestStreak = greenRun
		}
		if redRun > out.WorstStreak {
			out.WorstStreak = redRun
		}
		if pnl > bestPnl {
			bestPnl = pnl
		}
		if pnl < worstPnl {
			worstPnl = pnl
		}
	}
	if in.ShowAmounts && len(days) > 0 {
		out.BestDayPnl = fptrOf(bestPnl)
		out.WorstDayPnl = fptrOf(worstPnl)
	}
	return out
}

// shareEquity is cumulative net P&L from zero (no starting balance — that is
// account data). Hidden amounts scale the curve to max |value| = 1.
func shareEquity(ts []ClosedTrade, showAmounts bool) []ShareEquityPoint {
	if len(ts) == 0 {
		return []ShareEquityPoint{}
	}
	ordered := make([]ClosedTrade, len(ts))
	copy(ordered, ts)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].ClosedAt.Before(ordered[j].ClosedAt) })

	points := make([]ShareEquityPoint, 0, len(ordered))
	cum, maxAbs := 0.0, 0.0
	for _, t := range ordered {
		cum += t.NetPnl
		if a := math.Abs(cum); a > maxAbs {
			maxAbs = a
		}
		points = append(points, ShareEquityPoint{At: t.ClosedAt, Value: cum})
	}
	for i := range points {
		if showAmounts {
			points[i].Value = money.Round2(points[i].Value)
		} else if maxAbs > 0 {
			points[i].Value = math.Round(points[i].Value/maxAbs*10000) / 10000
		}
	}
	return points
}

func shareMonths(ts []ClosedTrade, loc *time.Location, showAmounts bool) []ShareMonth {
	type agg struct {
		trades int
		pnl    float64
	}
	byMonth := map[string]*agg{}
	for _, t := range ts {
		m := t.ClosedAt.In(loc).Format("2006-01")
		a := byMonth[m]
		if a == nil {
			a = &agg{}
			byMonth[m] = a
		}
		a.trades++
		a.pnl += t.NetPnl
	}
	keys := make([]string, 0, len(byMonth))
	for m := range byMonth {
		keys = append(keys, m)
	}
	sort.Strings(keys)
	out := make([]ShareMonth, 0, len(keys))
	for _, m := range keys {
		sm := ShareMonth{Month: m, Trades: byMonth[m].trades}
		if showAmounts {
			sm.Pnl = fptrOf(money.Round2(byMonth[m].pnl))
		}
		out = append(out, sm)
	}
	return out
}

func shareTopSymbols(groups map[string][]ClosedTrade, showAmounts bool) []ShareSymbol {
	ranked := Breakdown(groups)
	out := make([]ShareSymbol, 0, 3)
	for _, g := range ranked {
		if len(out) == 3 {
			break
		}
		sym := ShareSymbol{Symbol: g.Key, Trades: g.Summary.TotalTrades}
		if showAmounts {
			sym.Pnl = fptrOf(g.Summary.NetPnl)
		}
		out = append(out, sym)
	}
	return out
}

func fptrOf(v float64) *float64 { return &v }
