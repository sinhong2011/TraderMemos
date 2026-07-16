package marketdata

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChartableSymbol(t *testing.T) {
	require.False(t, ChartableSymbol(""))
	require.False(t, ChartableSymbol("E2E8500"))
	require.False(t, ChartableSymbol("12345"))
	require.True(t, ChartableSymbol("AAPL"))
	require.True(t, ChartableSymbol("TSLA"))
}
