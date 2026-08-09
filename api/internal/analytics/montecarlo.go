package analytics

import (
	"math/rand/v2"
	"slices"
	"sort"
)

// MonteCarloParams bound one simulation run. Zero values take the defaults;
// out-of-range values are clamped, so handlers can pass query params through.
type MonteCarloParams struct {
	Paths   int    // resampled equity paths; default 10_000
	Horizon int    // trades per path; default len(sample), capped
	Seed    uint64 // PRNG seed — same seed + sample → identical output
	// Drawdown that counts as ruin, as a positive currency magnitude.
	// 0 picks the historical max drawdown of the actual sequence, so the
	// default risk-of-ruin answers "odds of a drawdown worse than the one
	// already survived".
	RuinThreshold float64
}

const (
	mcDefaultPaths = 10_000
	mcMaxPaths     = 20_000
	mcMinPaths     = 200
	mcMaxHorizon   = 1_000
	// Fan-chart resolution: equity percentiles are reported at up to this
	// many evenly spaced steps, not every trade, to keep payloads flat.
	mcMaxCheckpoints = 60
	// Below this many closed trades a bootstrap mostly re-arranges noise.
	mcMinTrades = 10
)

// McBand is the cross-path equity distribution after N simulated trades.
type McBand struct {
	N   int     `json:"n"`
	P05 float64 `json:"p05"`
	P25 float64 `json:"p25"`
	P50 float64 `json:"p50"`
	P75 float64 `json:"p75"`
	P95 float64 `json:"p95"`
}

// McTerminal describes terminal equity (cumulative net P&L at the horizon).
type McTerminal struct {
	P05          float64 `json:"p05"`
	P25          float64 `json:"p25"`
	P50          float64 `json:"p50"`
	P75          float64 `json:"p75"`
	P95          float64 `json:"p95"`
	Mean         float64 `json:"mean"`
	ProbNegative float64 `json:"prob_negative"`
}

// McDrawdown describes the distribution of per-path max drawdowns, as
// positive magnitudes.
type McDrawdown struct {
	P50   float64 `json:"p50"`
	P90   float64 `json:"p90"`
	P95   float64 `json:"p95"`
	P99   float64 `json:"p99"`
	Worst float64 `json:"worst"`
}

type MonteCarloResult struct {
	// InsufficientData is set (and everything else zero) below mcMinTrades.
	InsufficientData bool `json:"insufficient_data"`
	Trades           int  `json:"trades"`
	Paths            int  `json:"paths"`
	Horizon          int  `json:"horizon"`
	// Seed echoes the run's PRNG seed so a client can reproduce or vary it.
	Seed  uint64     `json:"seed"`
	Steps []McBand   `json:"steps"`
	Term  McTerminal `json:"terminal"`
	MaxDD McDrawdown `json:"max_drawdown"`
	// RiskOfRuin is the share of paths whose max drawdown reached
	// RuinThreshold. The bootstrap treats trades as i.i.d. — no streaks,
	// regime changes, or sizing feedback — so it understates clustered risk.
	RiskOfRuin    float64 `json:"risk_of_ruin"`
	RuinThreshold float64 `json:"ruin_threshold"`
	// HistoricalMaxDD is the max drawdown of the actual sequence, for the
	// UI to anchor the simulated distribution against.
	HistoricalMaxDD float64 `json:"historical_max_drawdown"`
}

// MonteCarlo bootstrap-resamples per-trade net P&L into equity paths and
// summarizes the spread: fan-chart percentile bands per step, terminal
// equity, max-drawdown distribution, and risk of ruin.
func MonteCarlo(pnls []float64, p MonteCarloParams) MonteCarloResult {
	res := MonteCarloResult{Trades: len(pnls), Seed: p.Seed}
	if len(pnls) < mcMinTrades {
		res.InsufficientData = true
		return res
	}

	paths := clampInt(p.Paths, mcMinPaths, mcMaxPaths, mcDefaultPaths)
	horizon := clampInt(p.Horizon, 1, mcMaxHorizon, min(len(pnls), mcMaxHorizon))
	res.Paths, res.Horizon = paths, horizon

	res.HistoricalMaxDD = maxDrawdown(pnls)
	ruin := p.RuinThreshold
	if ruin <= 0 {
		ruin = res.HistoricalMaxDD
	}
	res.RuinThreshold = ruin

	checkpoints := checkpointSteps(horizon)
	// equity[c] collects every path's equity at checkpoint c.
	equity := make([][]float64, len(checkpoints))
	for i := range equity {
		equity[i] = make([]float64, paths)
	}
	terminals := make([]float64, paths)
	drawdowns := make([]float64, paths)
	ruined := 0

	rng := rand.New(rand.NewPCG(p.Seed, p.Seed^0x9e3779b97f4a7c15))
	for pi := range paths {
		var eq, peak, dd float64
		next := 0
		for step := 1; step <= horizon; step++ {
			eq += pnls[rng.IntN(len(pnls))]
			peak = max(peak, eq)
			dd = max(dd, peak-eq)
			if next < len(checkpoints) && checkpoints[next] == step {
				equity[next][pi] = eq
				next++
			}
		}
		terminals[pi] = eq
		drawdowns[pi] = dd
		if ruin > 0 && dd >= ruin {
			ruined++
		}
	}

	res.Steps = make([]McBand, len(checkpoints))
	for i, step := range checkpoints {
		sort.Float64s(equity[i])
		res.Steps[i] = McBand{
			N:   step,
			P05: sortedQuantile(equity[i], 0.05),
			P25: sortedQuantile(equity[i], 0.25),
			P50: sortedQuantile(equity[i], 0.50),
			P75: sortedQuantile(equity[i], 0.75),
			P95: sortedQuantile(equity[i], 0.95),
		}
	}

	sort.Float64s(terminals)
	var sum float64
	negatives := 0
	for _, v := range terminals {
		sum += v
		if v < 0 {
			negatives++
		}
	}
	res.Term = McTerminal{
		P05:          sortedQuantile(terminals, 0.05),
		P25:          sortedQuantile(terminals, 0.25),
		P50:          sortedQuantile(terminals, 0.50),
		P75:          sortedQuantile(terminals, 0.75),
		P95:          sortedQuantile(terminals, 0.95),
		Mean:         sum / float64(len(terminals)),
		ProbNegative: float64(negatives) / float64(len(terminals)),
	}

	sort.Float64s(drawdowns)
	res.MaxDD = McDrawdown{
		P50:   sortedQuantile(drawdowns, 0.50),
		P90:   sortedQuantile(drawdowns, 0.90),
		P95:   sortedQuantile(drawdowns, 0.95),
		P99:   sortedQuantile(drawdowns, 0.99),
		Worst: drawdowns[len(drawdowns)-1],
	}
	if ruin > 0 {
		res.RiskOfRuin = float64(ruined) / float64(paths)
	}
	return res
}

// checkpointSteps spreads up to mcMaxCheckpoints step indices evenly over
// 1..horizon, always ending exactly at the horizon.
func checkpointSteps(horizon int) []int {
	n := min(horizon, mcMaxCheckpoints)
	steps := make([]int, 0, n)
	for i := 1; i <= n; i++ {
		steps = append(steps, horizon*i/n)
	}
	return slices.Compact(steps)
}

// maxDrawdown is the deepest peak-to-trough fall of the cumulative P&L
// sequence in its actual order, as a positive magnitude.
func maxDrawdown(pnls []float64) float64 {
	var eq, peak, dd float64
	for _, p := range pnls {
		eq += p
		peak = max(peak, eq)
		dd = max(dd, peak-eq)
	}
	return dd
}

// sortedQuantile linearly interpolates quantile q from an ascending slice.
func sortedQuantile(sorted []float64, q float64) float64 {
	n := len(sorted)
	if n == 0 {
		return 0
	}
	pos := q * float64(n-1)
	lo := int(pos)
	if lo >= n-1 {
		return sorted[n-1]
	}
	frac := pos - float64(lo)
	return sorted[lo]*(1-frac) + sorted[lo+1]*frac
}

func clampInt(v, lo, hi, def int) int {
	if v == 0 {
		return def
	}
	return min(max(v, lo), hi)
}
