package coach

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var nyc = mustLoadNY()

func mustLoadNY() *time.Location {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		return time.FixedZone("EST", -5*3600)
	}
	return loc
}

// et builds a timestamp on the New York clock.
func et(y int, m time.Month, d, h, min int) time.Time {
	return time.Date(y, m, d, h, min, 0, 0, nyc)
}

func prior(closed time.Time, net float64) PriorTrade {
	return PriorTrade{Symbol: "AAPL", NetPnl: net, Currency: "USD", ClosedAt: closed}
}

func TestBuildSessionContextCountsOnlyClosesBeforeEntry(t *testing.T) {
	entry := et(2026, 7, 15, 13, 0)
	sc := BuildSessionContext(entry, "USD", []PriorTrade{
		prior(et(2026, 7, 15, 10, 0), -100),
		prior(et(2026, 7, 15, 11, 30), -40),
		// closed after the entry — must not count toward the entry-time state
		prior(et(2026, 7, 15, 15, 0), 500),
	}, nyc)

	require.Equal(t, 2, sc.PriorTradesToday)
	require.Equal(t, -140.0, sc.RealizedToday)
}

func TestBuildSessionContextRetrospectiveDayIsTheTradesOwnDay(t *testing.T) {
	// A trade entered three weeks ago is judged against that day, so closes
	// from later days must not leak into "that day".
	entry := et(2026, 6, 24, 9, 45)
	sc := BuildSessionContext(entry, "USD", []PriorTrade{
		prior(et(2026, 6, 24, 9, 40), -250),
		prior(et(2026, 6, 23, 15, 0), 900),
		prior(et(2026, 7, 14, 10, 0), -1000),
	}, nyc)

	require.Equal(t, "2026-06-24", sc.Day)
	require.Equal(t, 1, sc.PriorTradesToday)
	require.Equal(t, -250.0, sc.RealizedToday)
	require.Equal(t, 2, sc.PriorTradesWeek, "Jun 23 and Jun 24 share an ISO week")
}

func TestBuildSessionContextDayBoundaryFollowsMarketClock(t *testing.T) {
	// 01:30 UTC on Jul 16 is still Jul 15 on the New York clock.
	entry := time.Date(2026, 7, 16, 13, 0, 0, 0, time.UTC)
	afterHours := time.Date(2026, 7, 16, 1, 30, 0, 0, time.UTC)

	inNY := BuildSessionContext(entry, "USD", []PriorTrade{prior(afterHours, -75)}, nyc)
	require.Equal(t, "2026-07-16", inNY.Day)
	require.Zero(t, inNY.PriorTradesToday, "the close belongs to the previous NY day")

	inUTC := BuildSessionContext(entry, "USD", []PriorTrade{prior(afterHours, -75)}, time.UTC)
	require.Equal(t, 1, inUTC.PriorTradesToday)
}

func TestBuildSessionContextStreak(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	mk := func(nets ...float64) []PriorTrade {
		out := make([]PriorTrade, 0, len(nets))
		for i, n := range nets {
			out = append(out, prior(base.Add(time.Duration(i)*time.Minute), n))
		}
		return out
	}
	entry := base.Add(time.Hour)

	cases := []struct {
		name string
		nets []float64
		kind string
		n    int
	}{
		{"three losses", []float64{200, -50, -60, -70}, "loss", 3},
		{"two wins", []float64{-10, 40, 90}, "win", 2},
		{"scratch ends the run", []float64{-10, -20, 0}, "", 0},
		{"scratch blocks earlier losses", []float64{-10, 0, -20}, "loss", 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sc := BuildSessionContext(entry, "USD", mk(tc.nets...), nyc)
			require.Equal(t, tc.kind, sc.StreakKind)
			require.Equal(t, tc.n, sc.StreakLen)
		})
	}
}

func TestBuildSessionContextDrawdownFromZeroStart(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	// A lone loser is in drawdown by that loss — the peak is the zero start,
	// not the first trade's cumulative.
	sc := BuildSessionContext(base.Add(time.Hour), "USD", []PriorTrade{
		prior(base, -300),
	}, nyc)

	require.Equal(t, 300.0, sc.Drawdown)
	require.Equal(t, 1, sc.TradesSincePeak)
}

func TestBuildSessionContextDrawdownOffPeak(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	// cumulative: 500, 900 (peak), 700, 400 → 500 below peak, 2 trades since.
	sc := BuildSessionContext(base.Add(5*time.Hour), "USD", []PriorTrade{
		prior(base, 500),
		prior(base.Add(time.Minute), 400),
		prior(base.Add(2*time.Minute), -200),
		prior(base.Add(3*time.Minute), -300),
	}, nyc)

	require.Equal(t, 500.0, sc.Drawdown)
	require.Equal(t, 2, sc.TradesSincePeak)
}

func TestBuildSessionContextAtPeak(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	sc := BuildSessionContext(base.Add(time.Hour), "USD", []PriorTrade{
		prior(base, 100),
		prior(base.Add(time.Minute), 250),
	}, nyc)

	require.Zero(t, sc.Drawdown)
	require.Zero(t, sc.TradesSincePeak)
}

func TestBuildSessionContextExcludesOtherCurrencies(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	hkd := prior(base.Add(time.Minute), -8000)
	hkd.Currency = "HKD"
	sc := BuildSessionContext(base.Add(time.Hour), "USD", []PriorTrade{
		prior(base, -100),
		hkd,
	}, nyc)

	require.Equal(t, -100.0, sc.RealizedToday, "HKD must not be summed into a USD total")
	require.Equal(t, 1, sc.SkippedOtherCcy)
	require.Contains(t, sc.format(), "another currency were excluded")
}

func TestBuildSessionContextWindowBound(t *testing.T) {
	entry := et(2026, 7, 15, 9, 0)
	sc := BuildSessionContext(entry, "USD", []PriorTrade{
		prior(entry.Add(-SessionWindow-24*time.Hour), 5000),
		prior(entry.Add(-time.Hour), -100),
	}, nyc)

	require.True(t, sc.Bounded, "a prior outside the window should mark the context bounded")
	require.Equal(t, 1, sc.PriorsSeen)
	require.Contains(t, sc.format(), "180-day peak")
}

func TestBuildSessionContextEmptyPriors(t *testing.T) {
	sc := BuildSessionContext(et(2026, 7, 15, 9, 0), "USD", nil, nyc)

	require.Zero(t, sc.PriorTradesToday)
	require.Zero(t, sc.StreakLen)
	require.Zero(t, sc.Drawdown)

	out := sc.format()
	require.Contains(t, out, "Current streak: none")
	require.Contains(t, out, "all-time equity peak",
		"unbounded history should not claim a 180d peak")
}

func TestBuildSessionContextRecentNewestFirst(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	r := 1.5
	priors := []PriorTrade{
		prior(base, 10),
		prior(base.Add(time.Minute), 20),
		prior(base.Add(2*time.Minute), 30),
		{Symbol: "TSLA", NetPnl: -40, RMultiple: &r, Currency: "USD",
			ClosedAt: base.Add(3 * time.Minute), Emotion: "frustrated"},
	}
	sc := BuildSessionContext(base.Add(time.Hour), "USD", priors, nyc)

	require.Len(t, sc.Recent, maxRecentTrades)
	require.Equal(t, "TSLA", sc.Recent[0].Symbol, "newest close comes first")

	out := sc.format()
	for _, want := range []string{"TSLA net=-40", "R=1.5", "emotion=frustrated"} {
		require.Contains(t, out, want)
	}
}

func TestFormatTradeContextIncludesSession(t *testing.T) {
	entry := et(2026, 7, 15, 13, 0)
	sc := BuildSessionContext(entry, "USD", []PriorTrade{
		prior(et(2026, 7, 15, 10, 0), -100),
		prior(et(2026, 7, 15, 11, 0), -40),
	}, nyc)

	out := FormatTradeContext(TradeContext{
		Symbol: "AAPL", Direction: "long", Status: "closed",
		OpenedAt: entry, Currency: "USD", Session: &sc,
	})
	for _, want := range []string{
		"Trader state at the moment this trade was entered",
		"Entry day: 2026-07-15",
		"Prior closed trades that day: 2",
		"Realized that day before entry: -140 USD",
		"2 consecutive losses",
	} {
		require.Contains(t, out, want)
	}
}

func TestFormatTradeContextOmitsSessionWhenNil(t *testing.T) {
	out := FormatTradeContext(TradeContext{
		Symbol: "AAPL", Status: "closed", OpenedAt: et(2026, 7, 15, 13, 0),
	})
	require.NotContains(t, out, "Trader state at the moment")
}
