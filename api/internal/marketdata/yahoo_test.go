package marketdata

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestOccUnderlying(t *testing.T) {
	require.Equal(t, "TSLA", occUnderlying("TSLA250117C00425000"))
	require.Equal(t, "AAPL", occUnderlying("AAPL240315P00170000"))
	require.Equal(t, "", occUnderlying("TSLA"))
}

func TestDefaultInterval(t *testing.T) {
	from := time.Date(2026, 3, 10, 9, 30, 0, 0, time.UTC)
	require.Equal(t, "1", DefaultInterval(from, from.Add(90*time.Minute)))
	require.Equal(t, "5", DefaultInterval(from, from.Add(4*time.Hour)))
	require.Equal(t, "D", DefaultInterval(from, from.Add(30*24*time.Hour)))
}

func TestCacheKeyStable(t *testing.T) {
	from := time.Date(2026, 3, 10, 9, 30, 0, 0, time.UTC)
	to := from.Add(time.Hour)
	req := Request{Symbol: "aapl", InstrumentType: "stock", Interval: "5", From: from, To: to}
	k1 := CacheKey(req)
	req.Symbol = "AAPL"
	k2 := CacheKey(req)
	require.Equal(t, k1, k2)
}

func TestParseInterval(t *testing.T) {
	v, err := ParseInterval("")
	require.NoError(t, err)
	require.Equal(t, "5", v)
	_, err = ParseInterval("2h")
	require.Error(t, err)
}
