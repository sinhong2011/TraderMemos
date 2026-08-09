package analytics

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func shareFixture() ShareInput {
	trades := []ClosedTrade{
		tr(100, "2026-03-02T15:00:00Z"),
		tr(50, "2026-03-03T15:00:00Z"),
		tr(-30, "2026-03-04T15:00:00Z"),
		tr(-20, "2026-03-05T15:00:00Z"),
		tr(80, "2026-04-01T15:00:00Z"),
	}
	return ShareInput{
		Trades: trades,
		BySymbol: map[string][]ClosedTrade{
			"AAPL": {trades[0], trades[1]},
			"ES":   {trades[2], trades[3]},
			"NQ":   {trades[4]},
		},
	}
}

func TestBuildShareAggregateWithAmounts(t *testing.T) {
	in := shareFixture()
	in.ShowAmounts = true
	agg := BuildShareAggregate(in)

	require.Equal(t, 5, agg.Summary.TotalTrades)
	require.Equal(t, 3, agg.Summary.Wins)
	require.Equal(t, 2, agg.Summary.Losses)
	require.InDelta(t, 0.6, agg.Summary.WinRate, 1e-9)
	require.NotNil(t, agg.Summary.NetPnl)
	require.Equal(t, 180.0, *agg.Summary.NetPnl)

	require.Len(t, agg.Equity, 5)
	require.Equal(t, 180.0, agg.Equity[4].Value)

	require.Equal(t, []ShareMonth{
		{Month: "2026-03", Trades: 4, Pnl: fptrOf(100.0)},
		{Month: "2026-04", Trades: 1, Pnl: fptrOf(80.0)},
	}, agg.Months)

	require.Len(t, agg.TopSymbols, 3)
	require.Equal(t, "AAPL", agg.TopSymbols[0].Symbol)
	require.Equal(t, 150.0, *agg.TopSymbols[0].Pnl)

	require.Equal(t, 5, agg.TradingDays)
	require.Equal(t, 3, agg.GreenDays)
	require.Equal(t, 2, agg.RedDays)
	require.Equal(t, 2, agg.BestStreak)
	require.Equal(t, 2, agg.WorstStreak)
	require.Equal(t, "2026-03-02", agg.FirstDay)
	require.Equal(t, "2026-04-01", agg.LastDay)
	require.Equal(t, 100.0, *agg.BestDayPnl)
	require.Equal(t, -30.0, *agg.WorstDayPnl)
}

func TestBuildShareAggregateRedactsAmounts(t *testing.T) {
	agg := BuildShareAggregate(shareFixture())

	// Ratios survive; every money field must be gone from the JSON.
	require.Equal(t, 5, agg.Summary.TotalTrades)
	require.InDelta(t, 0.6, agg.Summary.WinRate, 1e-9)
	raw, err := json.Marshal(agg)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	summary := m["summary"].(map[string]any)
	for _, k := range []string{"net_pnl", "gross_profit", "gross_loss", "expectancy", "avg_win", "avg_loss", "avg_trade", "largest_win", "largest_loss", "total_fees"} {
		require.NotContains(t, summary, k)
	}
	require.NotContains(t, m, "best_day_pnl")
	require.NotContains(t, m, "worst_day_pnl")
	for _, month := range agg.Months {
		require.Nil(t, month.Pnl)
	}
	for _, sym := range agg.TopSymbols {
		require.Nil(t, sym.Pnl)
	}

	// The equity curve keeps its shape but is scaled to max |value| = 1.
	require.Len(t, agg.Equity, 5)
	maxAbs := 0.0
	for _, p := range agg.Equity {
		if a := p.Value; a < 0 {
			a = -a
			if a > maxAbs {
				maxAbs = a
			}
		} else if a > maxAbs {
			maxAbs = a
		}
	}
	require.InDelta(t, 1.0, maxAbs, 1e-9)
	// Peak 180 → 1.0; first point 100/180.
	require.InDelta(t, 100.0/180.0, agg.Equity[0].Value, 1e-3)
}

func TestBuildShareAggregateEmpty(t *testing.T) {
	agg := BuildShareAggregate(ShareInput{ShowAmounts: true})
	require.Equal(t, 0, agg.Summary.TotalTrades)
	require.NotNil(t, agg.Equity)
	require.Empty(t, agg.Equity)
	require.Empty(t, agg.Months)
	require.Empty(t, agg.TopSymbols)
	require.Equal(t, "", agg.FirstDay)
	require.Nil(t, agg.BestDayPnl)
}
