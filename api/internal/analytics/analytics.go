package analytics

import (
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

type ClosedTrade struct {
	NetPnl    float64
	GrossPnl  float64 // before fees; NetPnl + FeesTotal when the row lacks it
	FeesTotal float64
	OpenedAt  time.Time
	ClosedAt  time.Time
}

type CashFlow struct {
	Amount     float64
	OccurredAt time.Time
}

type Summary struct {
	TotalTrades  int     `json:"total_trades"`
	Wins         int     `json:"wins"`
	Losses       int     `json:"losses"`
	Breakeven    int     `json:"breakeven"`
	WinRate      float64 `json:"win_rate"`
	NetPnl       float64 `json:"net_pnl"`
	GrossPnl     float64 `json:"gross_pnl"`
	GrossProfit  float64 `json:"gross_profit"`
	GrossLoss    float64 `json:"gross_loss"`
	ProfitFactor float64 `json:"profit_factor"`
	Expectancy   float64 `json:"expectancy"`
	AvgWin       float64 `json:"avg_win"`
	AvgLoss      float64 `json:"avg_loss"`
	AvgTrade     float64 `json:"avg_trade"`
	LargestWin   float64 `json:"largest_win"`
	LargestLoss  float64 `json:"largest_loss"`
	TotalFees    float64 `json:"total_fees"`
	// Medians mirror the avg_* fields (median_loss is a positive magnitude,
	// like avg_loss) so the UI can swap outlier-resistant stats in place.
	MedianWin   float64 `json:"median_win"`
	MedianLoss  float64 `json:"median_loss"`
	MedianTrade float64 `json:"median_trade"`
	// KellyPct is the full-Kelly fraction as a percentage of capital,
	// W - (1-W)/R on win rate and payoff. Negative means no edge; zero when
	// there is not at least one win and one loss.
	KellyPct float64 `json:"kelly_pct"`
	// Sqn is Van Tharp's System Quality Number over per-trade net P&L:
	// sqrt(N) * mean / sample stddev. Zero when undefined (N < 2 or flat).
	Sqn float64 `json:"sqn"`
}

func Summarize(ts []ClosedTrade) Summary {
	var s Summary
	all := make([]float64, 0, len(ts))
	var winPnls, lossPnls []float64
	for _, t := range ts {
		s.TotalTrades++
		s.NetPnl += t.NetPnl
		s.GrossPnl += t.GrossPnl
		s.TotalFees += t.FeesTotal
		all = append(all, t.NetPnl)
		switch {
		case t.NetPnl > 0:
			s.Wins++
			s.GrossProfit += t.NetPnl
			winPnls = append(winPnls, t.NetPnl)
			if t.NetPnl > s.LargestWin {
				s.LargestWin = t.NetPnl
			}
		case t.NetPnl < 0:
			s.Losses++
			s.GrossLoss += -t.NetPnl
			lossPnls = append(lossPnls, -t.NetPnl)
			if -t.NetPnl > s.LargestLoss {
				s.LargestLoss = -t.NetPnl
			}
		default:
			s.Breakeven++
		}
	}
	if s.TotalTrades > 0 {
		s.WinRate = float64(s.Wins) / float64(s.TotalTrades)
		s.AvgTrade = money.Round2(s.NetPnl / float64(s.TotalTrades))
	}
	if s.Wins > 0 {
		s.AvgWin = money.Round2(s.GrossProfit / float64(s.Wins))
	}
	if s.Losses > 0 {
		s.AvgLoss = money.Round2(s.GrossLoss / float64(s.Losses))
	}
	if s.GrossLoss > 0 {
		s.ProfitFactor = money.Round2(s.GrossProfit / s.GrossLoss)
	}
	lossRate := 0.0
	if s.TotalTrades > 0 {
		lossRate = float64(s.Losses) / float64(s.TotalTrades)
	}
	s.Expectancy = money.Round2(s.WinRate*s.AvgWin - lossRate*s.AvgLoss)
	if s.TotalTrades > 0 {
		s.MedianTrade = money.Round2(median(all))
	}
	if s.Wins > 0 {
		s.MedianWin = money.Round2(median(winPnls))
	}
	if s.Losses > 0 {
		s.MedianLoss = money.Round2(median(lossPnls))
	}
	if s.Wins > 0 && s.Losses > 0 && s.AvgLoss > 0 {
		payoff := s.AvgWin / s.AvgLoss
		s.KellyPct = money.Round2(100 * (s.WinRate - (1-s.WinRate)/payoff))
	}
	if sd := sampleStddev(all); sd > 0 {
		mean := s.NetPnl / float64(s.TotalTrades)
		s.Sqn = money.Round2(math.Sqrt(float64(s.TotalTrades)) * mean / sd)
	}
	s.NetPnl = money.Round2(s.NetPnl)
	s.GrossPnl = money.Round2(s.GrossPnl)
	s.GrossProfit = money.Round2(s.GrossProfit)
	s.GrossLoss = money.Round2(s.GrossLoss)
	s.TotalFees = money.Round2(s.TotalFees)
	return s
}

func sampleStddev(xs []float64) float64 {
	n := len(xs)
	if n < 2 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	mean := sum / float64(n)
	var ss float64
	for _, x := range xs {
		d := x - mean
		ss += d * d
	}
	return math.Sqrt(ss / float64(n-1))
}

type EquityPoint struct {
	At     time.Time `json:"at"`
	Equity float64   `json:"equity"`
}
type Equity struct {
	Points      []EquityPoint `json:"points"`
	MaxDrawdown float64       `json:"max_drawdown"`
}

// EquityCurve merges cash flows + closed-trade P&L chronologically onto a starting balance.
func EquityCurve(startingBalance float64, flows []CashFlow, ts []ClosedTrade) Equity {
	type ev struct {
		at     time.Time
		amount float64
	}
	var evs []ev
	for _, f := range flows {
		evs = append(evs, ev{f.OccurredAt, f.Amount})
	}
	for _, t := range ts {
		evs = append(evs, ev{t.ClosedAt, t.NetPnl})
	}
	sort.SliceStable(evs, func(i, j int) bool { return evs[i].at.Before(evs[j].at) })

	eq := startingBalance
	peak := startingBalance
	var out Equity
	for _, e := range evs {
		eq = money.Round2(eq + e.amount)
		if eq > peak {
			peak = eq
		}
		if dd := peak - eq; dd > out.MaxDrawdown {
			out.MaxDrawdown = money.Round2(dd)
		}
		out.Points = append(out.Points, EquityPoint{At: e.at, Equity: eq})
	}
	return out
}

// DailyPnl aggregates net P&L per calendar day in loc (nil = UTC). Feeds the
// calendar heatmap. basis "open" keys by opened_at; anything else (including
// "") keys by closed_at.
func DailyPnl(ts []ClosedTrade, basis string, loc *time.Location) map[string]float64 {
	if loc == nil {
		loc = time.UTC
	}
	out := map[string]float64{}
	for _, t := range ts {
		at := t.ClosedAt
		if basis == "open" {
			at = t.OpenedAt
		}
		day := at.In(loc).Format("2006-01-02")
		out[day] = money.Round2(out[day] + t.NetPnl)
	}
	return out
}
