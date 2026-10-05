package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var scoreNow = time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)

// rTrades builds trades with $100 risk from a list of R outcomes.
func rTrades(rs ...float64) []ScorecardTrade {
	out := make([]ScorecardTrade, len(rs))
	for i, r := range rs {
		out[i] = ScorecardTrade{NetPnl: r * 100, InitialRisk: 100, OpenedAt: scoreNow.Add(-time.Duration(i) * time.Hour)}
	}
	return out
}

func repeat(n int, rs ...float64) []float64 {
	var out []float64
	for range n {
		out = append(out, rs...)
	}
	return out
}

func TestScoreSetupVerdicts(t *testing.T) {
	cases := []struct {
		name string
		rs   []float64
		want string
	}{
		{"fewer than 10 trades is unproven", repeat(3, 2, -1), VerdictUnproven},
		{"20+ trades with CI above zero is edge", repeat(15, 1.5, -0.5), VerdictEdge},
		{"20+ trades with CI below zero is bleeding", repeat(12, 0.5, -1.5), VerdictBleeding},
		{"positive but not significant is promising", repeat(6, 3, -1, -1), VerdictPromising},
		{"negative but not significant is watch", repeat(5, 1, -1, -1), VerdictWatch},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := ScoreSetup("s1", "Breakout", rTrades(tc.rs...), scoreNow)
			require.Equal(t, tc.want, s.Verdict, "mean=%v ci=[%v,%v]", s.Mean, deref(s.CILow), deref(s.CIHigh))
		})
	}
}

func TestScoreSetupExecutionProblem(t *testing.T) {
	// Clean trades pay +1R; mistake trades lose -3R and drag the setup negative.
	ts := rTrades(repeat(12, 1)...)
	for _, r := range repeat(6, -3) {
		ts = append(ts, ScorecardTrade{NetPnl: r * 100, InitialRisk: 100, Mistake: true, OpenedAt: scoreNow})
	}
	s := ScoreSetup("s1", "Pullback", ts, scoreNow)
	require.Equal(t, "r", s.Basis)
	require.Less(t, s.Mean, 0.0)
	require.Equal(t, 12, s.CleanTrades)
	require.Equal(t, 1.0, *s.CleanMean)
	require.Equal(t, VerdictExecution, s.Verdict)
}

func TestScoreSetupFallsBackToCurrency(t *testing.T) {
	// Only 2 of 10 trades carry risk, so the stats switch to currency.
	ts := make([]ScorecardTrade, 10)
	for i := range ts {
		ts[i] = ScorecardTrade{NetPnl: 50, OpenedAt: scoreNow}
	}
	ts[0].InitialRisk, ts[1].InitialRisk = 100, 100
	s := ScoreSetup("s1", "Gap fill", ts, scoreNow)
	require.Equal(t, "currency", s.Basis)
	require.Equal(t, 0.2, s.RCoverage)
	require.Equal(t, 50.0, s.Mean)
	require.Equal(t, 0.5, *s.ExpectancyR) // still reported for the trades that have it
	require.Equal(t, VerdictPromising, s.Verdict)
}

func TestScoreSetupStatsAndDistribution(t *testing.T) {
	s := ScoreSetup("s1", "ORB", rTrades(2.5, -1, -1, 1.5, 0), scoreNow)
	require.Equal(t, 5, s.Trades)
	require.Equal(t, 2, s.Wins)
	require.Equal(t, 2, s.Losses)
	require.Equal(t, 0.5, s.WinRate)
	require.Equal(t, 200.0, s.NetPnl)
	require.Equal(t, 40.0, s.Expectancy)
	require.Equal(t, 2.0, s.ProfitFactor) // 400 / 200
	require.Equal(t, 0.4, *s.ExpectancyR)
	require.Equal(t, 2.0, *s.AvgWinR)
	require.Equal(t, -1.0, *s.AvgLossR)
	counts := map[string]int{}
	for _, b := range s.Distribution {
		counts[b.Label] = b.Count
	}
	require.Equal(t, 2, counts["-1R to 0"]) // -1 lands in [-1, 0)
	require.Equal(t, 1, counts["0 to 1R"])
	require.Equal(t, 1, counts["1R to 2R"])
	require.Equal(t, 1, counts["≥ 2R"])
}

func TestScoreSetupStale(t *testing.T) {
	ts := rTrades(1, -1)
	for i := range ts {
		ts[i].OpenedAt = scoreNow.Add(-61 * 24 * time.Hour)
	}
	require.True(t, ScoreSetup("s1", "Old", ts, scoreNow).Stale)
	require.False(t, ScoreSetup("s1", "New", rTrades(1, -1), scoreNow).Stale)
}

func TestSortScorecard(t *testing.T) {
	rows := []SetupScore{
		{Name: "B", Verdict: VerdictBleeding},
		{Name: "U", Verdict: VerdictUnproven},
		{Name: "P2", Verdict: VerdictPromising, Mean: 0.2},
		{Name: "E", Verdict: VerdictEdge},
		{Name: "P1", Verdict: VerdictPromising, Mean: 0.6},
	}
	SortScorecard(rows)
	var names []string
	for _, r := range rows {
		names = append(names, r.Name)
	}
	require.Equal(t, []string{"E", "P1", "P2", "U", "B"}, names)
}

func deref(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}
