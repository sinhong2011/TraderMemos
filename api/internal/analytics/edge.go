package analytics

import (
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

// EdgeScoreVersion pins the formula below. Any change to a threshold or a
// weight changes what a score means, so it bumps the version rather than
// silently re-scoring history.
//
// Adapted from the open Edge Score in LuxAlgo/trade-journal (MIT):
// https://github.com/LuxAlgo/trade-journal/blob/main/docs/edge-score.md
const EdgeScoreVersion = 1

// EdgeScoreMinTrades is the fewest closed trades that get a score; below it the
// components still compute but the composite is null.
const EdgeScoreMinTrades = 5

// Full-marks thresholds. Each component scales linearly from 0 to 100 at its
// threshold and is clamped there.
const (
	edgeFullWinRate      = 0.60 // 60% winners
	edgeFullProfitFactor = 3.0
	edgeFullPayoff       = 2.5  // avg win : avg loss
	edgeZeroDrawdownPct  = 0.25 // 25%+ of peak equity scores 0
	edgeFullRecovery     = 3.0  // net P&L = 3x max drawdown
	edgeFullConcentrate  = 0.15 // best day <= 15% of all winning-day profit
)

// EdgeWeights sum to 100 so the composite reads as a 0-100 score.
var EdgeWeights = EdgeComponents{
	WinRate: 15, ProfitFactor: 25, Payoff: 20, Drawdown: 15, Recovery: 10, Consistency: 15,
}

// EdgeComponents holds each component's 0-100 score (or its weight, in EdgeWeights).
type EdgeComponents struct {
	WinRate      float64 `json:"win_rate"`
	ProfitFactor float64 `json:"profit_factor"`
	Payoff       float64 `json:"payoff"`
	Drawdown     float64 `json:"drawdown"`
	Recovery     float64 `json:"recovery"`
	Consistency  float64 `json:"consistency"`
}

// EdgeInputs are the raw metrics behind the components, so the UI can show
// what each score was computed from. Nil means undefined for this sample.
type EdgeInputs struct {
	WinRate        float64  `json:"win_rate"`
	ProfitFactor   *float64 `json:"profit_factor"` // nil: no losses (infinite)
	Payoff         *float64 `json:"payoff"`        // nil: no wins or no losses
	MaxDrawdown    float64  `json:"max_drawdown"`  // on trade P&L, cash flows excluded
	MaxDrawdownPct *float64 `json:"max_drawdown_pct"`
	RecoveryFactor *float64 `json:"recovery_factor"`
	// Largest winning day's share of all winning-day profit (0-1).
	BestDayShare *float64 `json:"best_day_share"`
}

type EdgeScore struct {
	Version      int            `json:"version"`
	Score        *float64       `json:"score"` // nil below EdgeScoreMinTrades
	Components   EdgeComponents `json:"components"`
	Weights      EdgeComponents `json:"weights"`
	Inputs       EdgeInputs     `json:"inputs"`
	ClosedTrades int            `json:"closed_trades"`
	MinTrades    int            `json:"min_trades"`
}

// tradingDrawdown measures drawdown on cumulative trade P&L alone, so a
// withdrawal is not mistaken for a loss. The percentage is taken against the
// capital in the account at the time (cash flows so far) plus the P&L peak.
//
// The "Opening balance" deposit is dated when the account was created, which
// is usually after the history imported into it. So while no capital precedes
// a trade, the accounts' total net deposits stand in as the capital it ran
// on. With no deposits at all the percentage is nil.
func tradingDrawdown(ts []ClosedTrade, flows []CashFlow) (float64, *float64) {
	trades := append([]ClosedTrade(nil), ts...)
	sort.SliceStable(trades, func(i, j int) bool { return trades[i].ClosedAt.Before(trades[j].ClosedAt) })
	cash := append([]CashFlow(nil), flows...)
	sort.SliceStable(cash, func(i, j int) bool { return cash[i].OccurredAt.Before(cash[j].OccurredAt) })

	var total float64
	for _, f := range cash {
		total += f.Amount
	}

	var capital, pnl, peak, maxDD float64
	var maxPct *float64
	next := 0
	for _, t := range trades {
		for next < len(cash) && !cash[next].OccurredAt.After(t.ClosedAt) {
			capital += cash[next].Amount
			next++
		}
		pnl += t.NetPnl
		peak = math.Max(peak, pnl)
		dd := peak - pnl
		maxDD = math.Max(maxDD, dd)
		funded := capital
		if funded <= 0 {
			funded = total
		}
		if funded > 0 {
			pct := math.Round(dd/(funded+peak)*1e4) / 1e4
			if maxPct == nil || pct > *maxPct {
				maxPct = &pct
			}
		}
	}
	return money.Round2(maxDD), maxPct
}

// ComputeEdgeScore scores a set of closed trades against the same accounts'
// cash flows; loc buckets trading days.
func ComputeEdgeScore(ts []ClosedTrade, flows []CashFlow, loc *time.Location) EdgeScore {
	s := Summarize(ts)
	maxDD, maxDDPct := tradingDrawdown(ts, flows)
	out := EdgeScore{
		Version: EdgeScoreVersion, Weights: EdgeWeights,
		ClosedTrades: s.TotalTrades, MinTrades: EdgeScoreMinTrades,
	}
	in := &out.Inputs
	c := &out.Components

	in.WinRate = s.WinRate
	in.MaxDrawdown = maxDD
	c.WinRate = clamp01(s.WinRate/edgeFullWinRate) * 100

	// Summarize reports profit factor 0 both for "no losses" and "no wins";
	// only the former is an unbounded edge.
	switch {
	case s.GrossLoss > 0:
		pf := money.Round2(s.GrossProfit / s.GrossLoss)
		in.ProfitFactor = &pf
		c.ProfitFactor = clamp01(pf/edgeFullProfitFactor) * 100
	case s.GrossProfit > 0:
		c.ProfitFactor = 100
	}

	if s.AvgWin > 0 && s.AvgLoss > 0 {
		payoff := money.Round2(s.AvgWin / s.AvgLoss)
		in.Payoff = &payoff
		c.Payoff = clamp01(payoff/edgeFullPayoff) * 100
	} else if s.AvgWin > 0 {
		c.Payoff = 100
	}

	// Without any deposit there is no capital to take a percentage of, so the
	// component scores a neutral 50 instead of guessing.
	if maxDDPct != nil {
		in.MaxDrawdownPct = maxDDPct
		c.Drawdown = (1 - clamp01(*maxDDPct/edgeZeroDrawdownPct)) * 100
	} else {
		c.Drawdown = 50
	}

	switch {
	case maxDD > 0:
		rf := money.Round2(s.NetPnl / maxDD)
		in.RecoveryFactor = &rf
		c.Recovery = clamp01(rf/edgeFullRecovery) * 100
	case s.NetPnl > 0:
		c.Recovery = 100
	}

	var best, winningDays float64
	for _, pnl := range DailyPnl(ts, "", loc) {
		if pnl > 0 {
			winningDays += pnl
			best = math.Max(best, pnl)
		}
	}
	if winningDays > 0 {
		share := math.Round(best/winningDays*1e4) / 1e4
		in.BestDayShare = &share
		if share <= edgeFullConcentrate {
			c.Consistency = 100
		} else {
			c.Consistency = (1 - clamp01((share-edgeFullConcentrate)/(1-edgeFullConcentrate))) * 100
		}
	}

	for _, v := range []*float64{
		&c.WinRate, &c.ProfitFactor, &c.Payoff, &c.Drawdown, &c.Recovery, &c.Consistency,
	} {
		*v = money.Round2(*v)
	}
	if s.TotalTrades >= EdgeScoreMinTrades {
		w := EdgeWeights
		score := money.Round2((c.WinRate*w.WinRate + c.ProfitFactor*w.ProfitFactor +
			c.Payoff*w.Payoff + c.Drawdown*w.Drawdown + c.Recovery*w.Recovery +
			c.Consistency*w.Consistency) / 100)
		out.Score = &score
	}
	return out
}
