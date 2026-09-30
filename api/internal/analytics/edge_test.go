package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func edgeDay(day int, pnl float64) ClosedTrade {
	at := time.Date(2026, 3, day, 15, 0, 0, 0, time.UTC)
	return ClosedTrade{NetPnl: pnl, GrossPnl: pnl, OpenedAt: at.Add(-time.Hour), ClosedAt: at}
}

// Hand-computed: 3 wins / 2 losses on five days after a 1000 deposit.
func TestEdgeScoreHandComputed(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 300), edgeDay(3, -100), edgeDay(4, 200), edgeDay(5, -100), edgeDay(6, 100)}
	deposit := []CashFlow{{Amount: 1000, OccurredAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)}}
	e := ComputeEdgeScore(ts, deposit, time.UTC)

	require.Equal(t, 5, e.ClosedTrades)
	require.Equal(t, 100.0, e.Components.WinRate)      // 60% = full marks
	require.Equal(t, 100.0, e.Components.ProfitFactor) // 600 / 200 = 3
	require.Equal(t, 80.0, e.Components.Payoff)        // 200 / 100 = 2 of 2.5
	// Deepest fall is 100 off the 1300 peak = 7.69%.
	require.InDelta(t, 0.0769, *e.Inputs.MaxDrawdownPct, 1e-9)
	require.InDelta(t, 69.24, e.Components.Drawdown, 1e-9)
	require.Equal(t, 100.0, e.Components.Recovery) // 400 net / 100 dd = 4
	// Best day 300 of 600 winning-day profit = 0.5.
	require.InDelta(t, 0.5, *e.Inputs.BestDayShare, 1e-9)
	require.InDelta(t, 58.82, e.Components.Consistency, 1e-9)
	require.NotNil(t, e.Score)
	require.InDelta(t, 85.21, *e.Score, 1e-9)
}

func TestEdgeScoreNeedsMinimumTrades(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 100), edgeDay(3, -50)}
	e := ComputeEdgeScore(ts, nil, time.UTC)
	require.Nil(t, e.Score)
	require.Equal(t, EdgeScoreMinTrades, e.MinTrades)
}

// No deposits: there is no capital to take a percentage of, so drawdown scores
// a neutral 50 rather than a guess.
func TestEdgeScoreNoDepositsDrawdownNeutral(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, -100), edgeDay(3, -50), edgeDay(4, 10), edgeDay(5, 10), edgeDay(6, 10)}
	e := ComputeEdgeScore(ts, nil, time.UTC)
	require.Nil(t, e.Inputs.MaxDrawdownPct)
	require.Equal(t, 50.0, e.Components.Drawdown)
	require.Equal(t, 0.0, e.Components.Recovery) // net -120: no recovery
}

func TestEdgeScoreNoLossesIsFullMarks(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 10), edgeDay(3, 10), edgeDay(4, 10), edgeDay(5, 10), edgeDay(6, 10)}
	e := ComputeEdgeScore(ts, nil, time.UTC)
	require.Nil(t, e.Inputs.ProfitFactor)
	require.Equal(t, 100.0, e.Components.ProfitFactor)
	require.Equal(t, 100.0, e.Components.Payoff)
	require.Equal(t, 100.0, e.Components.Recovery)
	// Each day is 10 of 50 = 20%, past the 15% full-marks line.
	require.InDelta(t, 94.12, e.Components.Consistency, 1e-9)
}

func TestEdgeScoreEmpty(t *testing.T) {
	e := ComputeEdgeScore(nil, nil, time.UTC)
	require.Nil(t, e.Score)
	require.Equal(t, 0, e.ClosedTrades)
	require.Equal(t, 0.0, e.Components.ProfitFactor)
}

// The opening-balance deposit is dated at account creation, after the history
// imported into it; it still counts as the capital those trades ran on.
func TestTradingDrawdownOpeningDepositAfterHistory(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 300), edgeDay(3, -100)}
	later := []CashFlow{{Amount: 1000, OccurredAt: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)}}
	dd, pct := tradingDrawdown(ts, later)
	require.Equal(t, 100.0, dd)
	require.InDelta(t, 0.0769, *pct, 1e-9) // 100 of 1000 + 300 peak
}

// A withdrawal lowers the capital base but is not itself a drawdown.
func TestTradingDrawdownIgnoresWithdrawals(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 100), edgeDay(4, 100)}
	flows := []CashFlow{
		{Amount: 1000, OccurredAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)},
		{Amount: -500, OccurredAt: time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)},
	}
	dd, pct := tradingDrawdown(ts, flows)
	require.Equal(t, 0.0, dd)
	require.Equal(t, 0.0, *pct)
}

// Two accounts whose opening deposits both post-date their history: the
// capital base is both deposits, not whichever came first.
func TestTradingDrawdownSumsLateOpeningDeposits(t *testing.T) {
	ts := []ClosedTrade{edgeDay(2, 300), edgeDay(3, -150)}
	late := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	dd, pct := tradingDrawdown(ts, []CashFlow{
		{Amount: 1000, OccurredAt: late},
		{Amount: 500, OccurredAt: late.Add(time.Minute)},
	})
	require.Equal(t, 150.0, dd)
	require.InDelta(t, 0.0833, *pct, 1e-9) // 150 of 1500 + 300 peak
}
