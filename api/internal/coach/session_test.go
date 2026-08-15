package coach

import (
	"strings"
	"testing"
	"time"
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

	if sc.PriorTradesToday != 2 {
		t.Fatalf("PriorTradesToday = %d, want 2", sc.PriorTradesToday)
	}
	if sc.RealizedToday != -140 {
		t.Fatalf("RealizedToday = %g, want -140", sc.RealizedToday)
	}
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

	if sc.Day != "2026-06-24" {
		t.Fatalf("Day = %s, want 2026-06-24", sc.Day)
	}
	if sc.PriorTradesToday != 1 || sc.RealizedToday != -250 {
		t.Fatalf("today = %d trades / %g, want 1 / -250", sc.PriorTradesToday, sc.RealizedToday)
	}
	if sc.PriorTradesWeek != 2 {
		t.Fatalf("PriorTradesWeek = %d, want 2 (Jun 23 and Jun 24 share an ISO week)", sc.PriorTradesWeek)
	}
}

func TestBuildSessionContextDayBoundaryFollowsMarketClock(t *testing.T) {
	// 01:30 UTC on Jul 16 is still Jul 15 on the New York clock.
	entry := time.Date(2026, 7, 16, 13, 0, 0, 0, time.UTC)
	afterHours := time.Date(2026, 7, 16, 1, 30, 0, 0, time.UTC)

	inNY := BuildSessionContext(entry, "USD", []PriorTrade{prior(afterHours, -75)}, nyc)
	if inNY.Day != "2026-07-16" || inNY.PriorTradesToday != 0 {
		t.Fatalf("NY: day=%s today=%d, want 2026-07-16 / 0", inNY.Day, inNY.PriorTradesToday)
	}

	inUTC := BuildSessionContext(entry, "USD", []PriorTrade{prior(afterHours, -75)}, time.UTC)
	if inUTC.PriorTradesToday != 1 {
		t.Fatalf("UTC: today=%d, want 1", inUTC.PriorTradesToday)
	}
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
			if sc.StreakKind != tc.kind || sc.StreakLen != tc.n {
				t.Fatalf("streak = %q/%d, want %q/%d", sc.StreakKind, sc.StreakLen, tc.kind, tc.n)
			}
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
	if sc.Drawdown != 300 {
		t.Fatalf("Drawdown = %g, want 300", sc.Drawdown)
	}
	if sc.TradesSincePeak != 1 {
		t.Fatalf("TradesSincePeak = %d, want 1", sc.TradesSincePeak)
	}
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
	if sc.Drawdown != 500 {
		t.Fatalf("Drawdown = %g, want 500", sc.Drawdown)
	}
	if sc.TradesSincePeak != 2 {
		t.Fatalf("TradesSincePeak = %d, want 2", sc.TradesSincePeak)
	}
}

func TestBuildSessionContextAtPeak(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	sc := BuildSessionContext(base.Add(time.Hour), "USD", []PriorTrade{
		prior(base, 100),
		prior(base.Add(time.Minute), 250),
	}, nyc)
	if sc.Drawdown != 0 || sc.TradesSincePeak != 0 {
		t.Fatalf("dd=%g since=%d, want 0/0", sc.Drawdown, sc.TradesSincePeak)
	}
}

func TestBuildSessionContextExcludesOtherCurrencies(t *testing.T) {
	base := et(2026, 7, 15, 9, 0)
	hkd := prior(base.Add(time.Minute), -8000)
	hkd.Currency = "HKD"
	sc := BuildSessionContext(base.Add(time.Hour), "USD", []PriorTrade{
		prior(base, -100),
		hkd,
	}, nyc)

	if sc.RealizedToday != -100 {
		t.Fatalf("RealizedToday = %g, want -100 (HKD must not be summed)", sc.RealizedToday)
	}
	if sc.SkippedOtherCcy != 1 {
		t.Fatalf("SkippedOtherCcy = %d, want 1", sc.SkippedOtherCcy)
	}
	if !strings.Contains(sc.format(), "another currency were excluded") {
		t.Fatal("brief should disclose the excluded trades")
	}
}

func TestBuildSessionContextWindowBound(t *testing.T) {
	entry := et(2026, 7, 15, 9, 0)
	sc := BuildSessionContext(entry, "USD", []PriorTrade{
		prior(entry.Add(-SessionWindow-24*time.Hour), 5000),
		prior(entry.Add(-time.Hour), -100),
	}, nyc)

	if !sc.Bounded {
		t.Fatal("Bounded = false, want true when a prior falls outside the window")
	}
	if sc.PriorsSeen != 1 {
		t.Fatalf("PriorsSeen = %d, want 1", sc.PriorsSeen)
	}
	if !strings.Contains(sc.format(), "180d peak") {
		t.Fatalf("brief should label the bounded peak:\n%s", sc.format())
	}
}

func TestBuildSessionContextEmptyPriors(t *testing.T) {
	sc := BuildSessionContext(et(2026, 7, 15, 9, 0), "USD", nil, nyc)
	if sc.PriorTradesToday != 0 || sc.StreakLen != 0 || sc.Drawdown != 0 {
		t.Fatalf("unexpected state for a first trade: %+v", sc)
	}
	out := sc.format()
	if !strings.Contains(out, "Current streak: none") {
		t.Fatalf("missing streak line:\n%s", out)
	}
	if !strings.Contains(out, "all recorded equity peak") {
		t.Fatalf("unbounded history should not claim a 180d peak:\n%s", out)
	}
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

	if len(sc.Recent) != maxRecentTrades {
		t.Fatalf("Recent = %d, want %d", len(sc.Recent), maxRecentTrades)
	}
	if sc.Recent[0].Symbol != "TSLA" {
		t.Fatalf("Recent[0] = %s, want the newest close (TSLA)", sc.Recent[0].Symbol)
	}
	out := sc.format()
	for _, want := range []string{"TSLA net=-40", "R=1.5", "emotion=frustrated"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
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
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
	}
}

func TestFormatTradeContextOmitsSessionWhenNil(t *testing.T) {
	out := FormatTradeContext(TradeContext{
		Symbol: "AAPL", Status: "closed", OpenedAt: et(2026, 7, 15, 13, 0),
	})
	if strings.Contains(out, "Trader state at the moment") {
		t.Fatalf("nil session must not render a block:\n%s", out)
	}
}
