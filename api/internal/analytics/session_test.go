package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSessionName(t *testing.T) {
	// 2026-01-02 is a Friday.
	cases := []struct {
		utc  string
		want string
	}{
		{"2026-01-02T09:00:00Z", "Premarket"}, // 04:00 ET
		{"2026-01-02T14:30:00Z", "RTH"},        // 09:30 ET
		{"2026-01-02T20:00:00Z", "RTH"},        // 15:00 ET
		{"2026-01-02T21:00:00Z", "Afterhours"}, // 16:00 ET
		{"2026-01-03T02:00:00Z", "Overnight"},  // 21:00 ET Fri
	}
	for _, tc := range cases {
		ts, err := time.Parse(time.RFC3339, tc.utc)
		require.NoError(t, err)
		require.Equal(t, tc.want, SessionName(ts), tc.utc)
	}
}

func TestHourBucketUTC(t *testing.T) {
	ts, err := time.Parse(time.RFC3339, "2026-01-02T14:45:00Z")
	require.NoError(t, err)
	require.Equal(t, "14:00", HourBucket(ts))
	require.Equal(t, "Friday", WeekdayName(ts))
}
