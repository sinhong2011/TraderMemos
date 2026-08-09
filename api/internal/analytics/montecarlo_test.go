package analytics

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func mcSample() []float64 {
	// 5 losing, 15 winning trades with a positive edge.
	pnls := make([]float64, 0, 20)
	for i := 0; i < 15; i++ {
		pnls = append(pnls, 100)
	}
	for i := 0; i < 5; i++ {
		pnls = append(pnls, -150)
	}
	return pnls
}

func TestMonteCarloInsufficientData(t *testing.T) {
	res := MonteCarlo([]float64{10, -5, 20}, MonteCarloParams{})
	require.True(t, res.InsufficientData)
	require.Equal(t, 3, res.Trades)
	require.Empty(t, res.Steps)
}

func TestMonteCarloDeterministicBySeed(t *testing.T) {
	p := MonteCarloParams{Paths: 500, Seed: 42}
	a := MonteCarlo(mcSample(), p)
	b := MonteCarlo(mcSample(), p)
	require.Equal(t, a, b)

	c := MonteCarlo(mcSample(), MonteCarloParams{Paths: 500, Seed: 43})
	require.NotEqual(t, a.Term, c.Term)
}

func TestMonteCarloShapeAndOrdering(t *testing.T) {
	res := MonteCarlo(mcSample(), MonteCarloParams{Paths: 1000, Seed: 7})
	require.False(t, res.InsufficientData)
	require.Equal(t, 1000, res.Paths)
	require.Equal(t, 20, res.Horizon) // defaults to sample size
	require.NotEmpty(t, res.Steps)
	require.Equal(t, res.Horizon, res.Steps[len(res.Steps)-1].N)

	prev := 0
	for _, b := range res.Steps {
		require.Greater(t, b.N, prev) // strictly increasing checkpoints
		prev = b.N
		require.LessOrEqual(t, b.P05, b.P25)
		require.LessOrEqual(t, b.P25, b.P50)
		require.LessOrEqual(t, b.P50, b.P75)
		require.LessOrEqual(t, b.P75, b.P95)
	}
	require.LessOrEqual(t, res.Term.P05, res.Term.P50)
	require.LessOrEqual(t, res.Term.P50, res.Term.P95)
	require.LessOrEqual(t, res.MaxDD.P50, res.MaxDD.P90)
	require.LessOrEqual(t, res.MaxDD.P99, res.MaxDD.Worst)

	// Positive edge: expected terminal ≈ horizon × mean(sample) = 20 × 37.5.
	require.InDelta(t, 750, res.Term.Mean, 100)
	require.Less(t, res.Term.ProbNegative, 0.5)
}

func TestMonteCarloAllWinnersHasNoRuin(t *testing.T) {
	pnls := make([]float64, 12)
	for i := range pnls {
		pnls[i] = 50
	}
	res := MonteCarlo(pnls, MonteCarloParams{Paths: 300, Seed: 1, RuinThreshold: 100})
	require.Zero(t, res.RiskOfRuin)
	require.Zero(t, res.Term.ProbNegative)
	require.Zero(t, res.HistoricalMaxDD)
	require.Equal(t, 100.0, res.RuinThreshold)
}

func TestMonteCarloDefaultRuinIsHistoricalMaxDD(t *testing.T) {
	res := MonteCarlo(mcSample(), MonteCarloParams{Paths: 300, Seed: 1})
	// Sample order: 15 wins then 5 straight -150 losses → historical DD 750.
	require.Equal(t, 750.0, res.HistoricalMaxDD)
	require.Equal(t, 750.0, res.RuinThreshold)
	require.Greater(t, res.RiskOfRuin, 0.0) // resamples can cluster losses deeper
}

func TestMonteCarloClampsParams(t *testing.T) {
	res := MonteCarlo(mcSample(), MonteCarloParams{Paths: 1, Horizon: 1 << 20, Seed: 1})
	require.Equal(t, mcMinPaths, res.Paths)
	require.Equal(t, mcMaxHorizon, res.Horizon)
}

func TestMaxDrawdown(t *testing.T) {
	require.Equal(t, 15.0, maxDrawdown([]float64{10, -5, -10, 20}))
	require.Equal(t, 0.0, maxDrawdown([]float64{1, 2, 3}))
	require.Equal(t, 0.0, maxDrawdown(nil))
}

func TestSortedQuantile(t *testing.T) {
	s := []float64{10, 20, 30, 40}
	require.Equal(t, 10.0, sortedQuantile(s, 0))
	require.Equal(t, 40.0, sortedQuantile(s, 1))
	require.Equal(t, 25.0, sortedQuantile(s, 0.5))
	require.Equal(t, 0.0, sortedQuantile(nil, 0.5))
}
