package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func tr(net float64, closed string) ClosedTrade {
	tt, _ := time.Parse(time.RFC3339, closed)
	return ClosedTrade{NetPnl: net, GrossPnl: net + 1, FeesTotal: 1, OpenedAt: tt, ClosedAt: tt}
}

func TestDailyPnlDateBasis(t *testing.T) {
	opened, _ := time.Parse(time.RFC3339, "2026-07-21T20:00:00Z")
	closed, _ := time.Parse(time.RFC3339, "2026-07-22T14:00:00Z")
	in := []ClosedTrade{{NetPnl: 88.3, FeesTotal: 1, OpenedAt: opened, ClosedAt: closed}}

	byClose := DailyPnl(in, "close", nil)
	require.Equal(t, 88.3, byClose["2026-07-22"])
	require.Equal(t, 0.0, byClose["2026-07-21"])

	byOpen := DailyPnl(in, "open", nil)
	require.Equal(t, 88.3, byOpen["2026-07-21"])
	require.Equal(t, 0.0, byOpen["2026-07-22"])
}

func TestDailyPnlTraderClock(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	// Closed 2026-07-22 00:30 UTC = still 2026-07-21 evening in New York.
	closed, _ := time.Parse(time.RFC3339, "2026-07-22T00:30:00Z")
	in := []ClosedTrade{{NetPnl: 50, OpenedAt: closed, ClosedAt: closed}}

	require.Equal(t, 50.0, DailyPnl(in, "close", ny)["2026-07-21"])
	require.Equal(t, 50.0, DailyPnl(in, "close", nil)["2026-07-22"])
}

func TestSummary(t *testing.T) {
	in := []ClosedTrade{
		tr(200, "2026-01-01T11:00:00Z"),
		tr(-100, "2026-01-02T11:00:00Z"),
		tr(300, "2026-01-03T11:00:00Z"),
	}
	s := Summarize(in)
	require.Equal(t, 3, s.TotalTrades)
	require.Equal(t, 2, s.Wins)
	require.Equal(t, 1, s.Losses)
	require.InDelta(t, 0.6667, s.WinRate, 0.001)
	require.Equal(t, 400.0, s.NetPnl)     // 200-100+300
	require.Equal(t, 403.0, s.GrossPnl)   // net + 1 fee per trade
	require.Equal(t, 5.0, s.ProfitFactor) // (200+300)/100
	require.Equal(t, 250.0, s.AvgWin)
	require.Equal(t, 100.0, s.AvgLoss)
}

func TestSummaryKellySqnMedians(t *testing.T) {
	in := []ClosedTrade{
		tr(200, "2026-01-01T11:00:00Z"),
		tr(-100, "2026-01-02T11:00:00Z"),
		tr(300, "2026-01-03T11:00:00Z"),
	}
	s := Summarize(in)
	require.Equal(t, 200.0, s.MedianTrade)
	require.Equal(t, 250.0, s.MedianWin)
	require.Equal(t, 100.0, s.MedianLoss)
	// W=2/3, R=250/100 → 100*(2/3 - (1/3)/2.5) = 53.33
	require.InDelta(t, 53.33, s.KellyPct, 0.01)
	// mean 133.33, sample stddev 208.17 → sqrt(3)*mean/sd = 1.11
	require.InDelta(t, 1.11, s.Sqn, 0.01)
}

func TestSummaryKellySqnUndefined(t *testing.T) {
	// No losses: Kelly needs at least one win and one loss.
	allWins := Summarize([]ClosedTrade{
		tr(100, "2026-01-01T11:00:00Z"),
		tr(200, "2026-01-02T11:00:00Z"),
	})
	require.Equal(t, 0.0, allWins.KellyPct)
	require.Equal(t, 150.0, allWins.MedianWin)
	require.Equal(t, 0.0, allWins.MedianLoss)
	require.Equal(t, 3.0, allWins.Sqn) // sqrt(2)*150/70.71

	// Single trade / flat results: stddev undefined → SQN 0.
	one := Summarize([]ClosedTrade{tr(100, "2026-01-01T11:00:00Z")})
	require.Equal(t, 0.0, one.Sqn)
	flat := Summarize([]ClosedTrade{
		tr(100, "2026-01-01T11:00:00Z"),
		tr(100, "2026-01-02T11:00:00Z"),
	})
	require.Equal(t, 0.0, flat.Sqn)

	// Losing edge produces a negative Kelly, not zero.
	losing := Summarize([]ClosedTrade{
		tr(50, "2026-01-01T11:00:00Z"),
		tr(-100, "2026-01-02T11:00:00Z"),
		tr(-100, "2026-01-03T11:00:00Z"),
	})
	require.Less(t, losing.KellyPct, 0.0)
}

func TestEquityCurveAndDrawdown(t *testing.T) {
	in := []ClosedTrade{
		tr(100, "2026-01-01T11:00:00Z"),
		tr(-50, "2026-01-02T11:00:00Z"),
		tr(25, "2026-01-03T11:00:00Z"),
	}
	curve := EquityCurve(1000, nil, in)
	require.Equal(t, 1100.0, curve.Points[0].Equity)
	require.Equal(t, 1050.0, curve.Points[1].Equity)
	require.Equal(t, 1075.0, curve.Points[2].Equity)
	require.Equal(t, 50.0, curve.MaxDrawdown) // peak 1100 -> trough 1050
}
