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
	load := func(name string) *time.Location {
		loc, err := time.LoadLocation(name)
		require.NoError(t, err)
		return loc
	}
	ny := load("America/New_York")
	hk := load("Asia/Hong_Kong")

	cases := []struct {
		name   string
		open   string
		close  string
		secs   *int64
		loc    *time.Location
		expect string
	}{
		// Default clock (nil loc) is New York — unchanged from before tz threading.
		// 14:00 → 21:00 ET, both Jan 2 ET (crosses UTC midnight) → not swing.
		{"default: same ET day held 2h", "2026-01-02T19:00:00Z", "2026-01-03T02:00:00Z", secs(7200), nil, "day"},
		{"default: same ET day 5min", "2026-01-02T19:00:00Z", "2026-01-03T02:00:00Z", secs(300), nil, "scalp"},
		{"default: unknown duration", "2026-01-02T19:00:00Z", "2026-01-03T02:00:00Z", nil, nil, "day"},
		{"default: later ET day", "2026-01-02T15:00:00Z", "2026-01-05T15:00:00Z", secs(120), nil, "swing"},

		// 10:30 → 11:30 ET on Jan 2 is 23:30 Jan 2 → 00:30 Jan 3 in Hong Kong.
		{"NY day stays day in NY", "2026-01-02T15:30:00Z", "2026-01-02T16:30:00Z", secs(3600), ny, "day"},
		{"NY day stays day by default", "2026-01-02T15:30:00Z", "2026-01-02T16:30:00Z", secs(3600), nil, "day"},
		{"NY day crosses HK midnight", "2026-01-02T15:30:00Z", "2026-01-02T16:30:00Z", secs(3600), hk, "swing"},
		{"NY scalp crosses HK midnight", "2026-01-02T15:58:00Z", "2026-01-02T16:03:00Z", secs(300), hk, "swing"},

		// Vice versa: 12:30 → 13:30 HKT on Jan 3 is 23:30 Jan 2 → 00:30 Jan 3 in NY.
		{"HK day stays day in HK", "2026-01-03T04:30:00Z", "2026-01-03T05:30:00Z", secs(3600), hk, "day"},
		{"HK scalp stays scalp in HK", "2026-01-03T04:58:00Z", "2026-01-03T05:03:00Z", secs(300), hk, "scalp"},
		{"HK day crosses NY midnight", "2026-01-03T04:30:00Z", "2026-01-03T05:30:00Z", secs(3600), ny, "swing"},
		{"HK day crosses default midnight", "2026-01-03T04:30:00Z", "2026-01-03T05:30:00Z", secs(3600), nil, "swing"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expect, DurationBucket(p(tc.open), p(tc.close), tc.secs, tc.loc))
		})
	}
}

// Session buckets stay on the US exchange clock no matter the market tz:
// SessionName takes no location, so this pins the contract that 09:30 ET is
// RTH even for a trader whose day/duration clock is Hong Kong.
func TestSessionNameIgnoresMarketTZ(t *testing.T) {
	at, err := time.Parse(time.RFC3339, "2026-01-02T14:30:00Z") // 09:30 ET, 22:30 HKT
	require.NoError(t, err)
	require.Equal(t, "RTH", SessionName(at))
	require.Equal(t, "America/New_York", DefaultSessionTZ)
}
