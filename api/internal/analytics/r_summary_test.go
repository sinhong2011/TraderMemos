package analytics

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSummarizeR(t *testing.T) {
	out := SummarizeR([]RiskTrade{
		{NetPnl: 100, InitialRisk: 50},  // +2R
		{NetPnl: -25, InitialRisk: 50}, // -0.5R
		{NetPnl: 0, InitialRisk: 50},   // 0R
	}, 2)
	require.Equal(t, 2, out.Excluded)
	require.Equal(t, 3, out.TotalTrades)
	require.Equal(t, 2.0, out.BestR)
	require.Equal(t, -0.5, out.WorstR)
	require.Equal(t, 0.5, out.AvgR) // (2 - 0.5 + 0) / 3
}
