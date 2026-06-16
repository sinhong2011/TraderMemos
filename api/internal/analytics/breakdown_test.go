package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBreakdownByKey(t *testing.T) {
	tt, _ := time.Parse(time.RFC3339, "2026-01-01T11:00:00Z")
	groups := map[string][]ClosedTrade{
		"AAPL": {{NetPnl: 200, ClosedAt: tt}, {NetPnl: -50, ClosedAt: tt}},
		"MSFT": {{NetPnl: 300, ClosedAt: tt}},
	}
	out := Breakdown(groups)
	require.Len(t, out, 2)
	// sorted by net pnl desc: MSFT(300) then AAPL(150)
	require.Equal(t, "MSFT", out[0].Key)
	require.Equal(t, 300.0, out[0].Summary.NetPnl)
	require.Equal(t, "AAPL", out[1].Key)
	require.Equal(t, 150.0, out[1].Summary.NetPnl)
}
