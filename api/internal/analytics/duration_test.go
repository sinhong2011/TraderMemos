package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDurationBucket(t *testing.T) {
	p := func(s string) time.Time {
		ts, err := time.Parse(time.RFC3339, s)
		require.NoError(t, err)
		return ts
	}
	secs := func(n int64) *int64 { return &n }

	// Opened 14:00 ET, closed 21:00 ET SAME ET day (both 2026-01-02 ET) → not swing.
	openSameDay := p("2026-01-02T19:00:00Z")  // 14:00 ET
	closeSameDay := p("2026-01-03T02:00:00Z") // 21:00 ET, still Jan 2 ET
	require.Equal(t, "day", DurationBucket(openSameDay, closeSameDay, secs(7200)))
	require.Equal(t, "scalp", DurationBucket(openSameDay, closeSameDay, secs(300)))
	require.Equal(t, "day", DurationBucket(openSameDay, closeSameDay, nil)) // unknown duration → day

	// Closed on a later ET calendar day → swing regardless of secs.
	openD1 := p("2026-01-02T15:00:00Z")  // 10:00 ET Jan 2
	closeD2 := p("2026-01-05T15:00:00Z") // 10:00 ET Jan 5
	require.Equal(t, "swing", DurationBucket(openD1, closeD2, secs(120)))
}
