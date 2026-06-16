package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDedupHashStable(t *testing.T) {
	ts := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	a := DedupHash("AAPL", "buy", 100, 10.5, ts)
	b := DedupHash("AAPL", "buy", 100, 10.5, ts)
	c := DedupHash("AAPL", "sell", 100, 10.5, ts)
	require.Equal(t, a, b)
	require.NotEqual(t, a, c)
}
