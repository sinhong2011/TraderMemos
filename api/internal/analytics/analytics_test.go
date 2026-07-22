package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func tr(net float64, closed string) ClosedTrade {
	tt, _ := time.Parse(time.RFC3339, closed)
	return ClosedTrade{NetPnl: net, FeesTotal: 1, OpenedAt: tt, ClosedAt: tt}
}

func TestDailyPnlDateBasis(t *testing.T) {
	opened, _ := time.Parse(time.RFC3339, "2026-07-21T20:00:00Z")
	closed, _ := time.Parse(time.RFC3339, "2026-07-22T14:00:00Z")
	in := []ClosedTrade{{NetPnl: 88.3, FeesTotal: 1, OpenedAt: opened, ClosedAt: closed}}

	byClose := DailyPnl(in, "close")
	require.Equal(t, 88.3, byClose["2026-07-22"])
	require.Equal(t, 0.0, byClose["2026-07-21"])

	byOpen := DailyPnl(in, "open")
	require.Equal(t, 88.3, byOpen["2026-07-21"])
	require.Equal(t, 0.0, byOpen["2026-07-22"])
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
	require.Equal(t, 400.0, s.NetPnl)          // 200-100+300
	require.Equal(t, 5.0, s.ProfitFactor)      // (200+300)/100
	require.Equal(t, 250.0, s.AvgWin)
	require.Equal(t, 100.0, s.AvgLoss)
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
