package alerts

import (
	"strings"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/analytics"
)

func mustLoc(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func TestReviewWeekBoundaries(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	hk := mustLoc(t, "Asia/Hong_Kong")
	cases := []struct {
		name      string
		now       time.Time
		loc       *time.Location
		wantStart string
		wantDue   bool
	}{
		{"saturday 08:59 NY is not due", time.Date(2026, 10, 3, 8, 59, 59, 0, ny), ny, "2026-09-28", false},
		{"saturday 09:00 NY is due", time.Date(2026, 10, 3, 9, 0, 0, 0, ny), ny, "2026-09-28", true},
		{"sunday night NY is still that week", time.Date(2026, 10, 4, 23, 59, 0, 0, ny), ny, "2026-09-28", true},
		{"monday 00:00 NY starts a new week, not due", time.Date(2026, 10, 5, 0, 0, 0, 0, ny), ny, "2026-10-05", false},
		{"friday NY not due", time.Date(2026, 10, 2, 16, 0, 0, 0, ny), ny, "2026-09-28", false},
		// 13:00 UTC Saturday is 09:00 EDT: the boundary follows the market
		// timezone, not the server's.
		{"UTC instant at NY 09:00", time.Date(2026, 10, 3, 13, 0, 0, 0, time.UTC), ny, "2026-09-28", true},
		{"UTC instant a minute before NY 09:00", time.Date(2026, 10, 3, 12, 59, 0, 0, time.UTC), ny, "2026-09-28", false},
		// Saturday 01:00 UTC is already Saturday 09:00 in Hong Kong.
		{"HK 09:00 is Saturday 01:00 UTC", time.Date(2026, 10, 3, 1, 0, 0, 0, time.UTC), hk, "2026-09-28", true},
		{"HK 08:59", time.Date(2026, 10, 3, 0, 59, 0, 0, time.UTC), hk, "2026-09-28", false},
		// The week US DST ends (Sun Nov 1 2026): Monday is still Oct 26.
		{"DST-end week", time.Date(2026, 11, 1, 12, 0, 0, 0, ny), ny, "2026-10-26", true},
		{"week across a year", time.Date(2027, 1, 2, 9, 0, 0, 0, ny), ny, "2026-12-28", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			start, due := ReviewWeek(tc.now, tc.loc)
			if got := WeekKey(start); got != tc.wantStart {
				t.Errorf("start = %s, want %s", got, tc.wantStart)
			}
			if due != tc.wantDue {
				t.Errorf("due = %v, want %v", due, tc.wantDue)
			}
			if h, m := start.Hour(), start.Minute(); h != 0 || m != 0 {
				t.Errorf("start not local midnight: %v", start)
			}
		})
	}
}

func TestWeekLabelAndTitle(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	start, _ := ReviewWeek(time.Date(2026, 10, 3, 10, 0, 0, 0, ny), ny)
	if got := WeeklyNoteTitle(start); got != "Week of Sep 28 – Oct 4" {
		t.Errorf("title = %q", got)
	}
	start, _ = ReviewWeek(time.Date(2026, 10, 31, 10, 0, 0, 0, ny), ny)
	if got := WeekLabel(start); got != "Oct 26 – Nov 1" {
		t.Errorf("DST week label = %q", got)
	}
	if end := weekEnd(start); end.Hour() != 0 || WeekKey(end) != "2026-11-02" {
		t.Errorf("DST week end = %v, want local midnight Nov 2", end)
	}
}

func TestComputeWeeklyBucketsInMarketTimezone(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	start := time.Date(2026, 9, 28, 0, 0, 0, 0, ny)
	trades := []WeeklyTrade{
		// Sunday 23:30 NY before the week — Monday 03:30 UTC, but last week.
		{NetPnl: 1000, ClosedAt: time.Date(2026, 9, 28, 3, 30, 0, 0, time.UTC), Setup: "ORB", Currency: "USD"},
		// Monday 00:10 NY — first trade of the week (Monday 04:10 UTC).
		{NetPnl: 300, ClosedAt: time.Date(2026, 9, 28, 0, 10, 0, 0, ny), InitialRisk: 100, Setup: "ORB", Currency: "USD"},
		{NetPnl: 200, ClosedAt: time.Date(2026, 9, 29, 10, 0, 0, 0, ny), InitialRisk: 100, Setup: "ORB", Currency: "USD"},
		{NetPnl: -150, ClosedAt: time.Date(2026, 9, 30, 10, 0, 0, 0, ny), InitialRisk: 50, Setup: "VWAP fade", Currency: "USD"},
		{NetPnl: 0, ClosedAt: time.Date(2026, 10, 1, 10, 0, 0, 0, ny), Currency: "USD"},
		{NetPnl: -50, ClosedAt: time.Date(2026, 10, 2, 15, 0, 0, 0, ny), Setup: "Gap fill", Currency: "USD"},
		// Sunday 23:59 NY — still this week (Monday 03:59 UTC).
		{NetPnl: 25.5, ClosedAt: time.Date(2026, 10, 4, 23, 59, 0, 0, ny), Currency: "USD"},
		// Monday 00:00 NY next week — out.
		{NetPnl: 999, ClosedAt: time.Date(2026, 10, 5, 0, 0, 0, 0, ny), Currency: "USD"},
	}
	missed := []time.Time{
		time.Date(2026, 9, 27, 12, 0, 0, 0, ny), // previous Sunday — out
		time.Date(2026, 9, 29, 9, 45, 0, 0, ny),
		time.Date(2026, 10, 3, 8, 0, 0, 0, ny),
	}
	rules := analytics.ComplianceRules{MaxRiskPerTrade: 75, MaxTradesPerDay: 5}
	st := ComputeWeekly(trades, rules, missed, start, ny, "USD")

	if st.Trades != 6 || st.Wins != 3 || st.Losses != 2 {
		t.Fatalf("trades/wins/losses = %d/%d/%d, want 6/3/2", st.Trades, st.Wins, st.Losses)
	}
	if len(st.NetPnl) != 1 || st.NetPnl[0].Amount != 325.5 || st.NetPnl[0].Currency != "USD" {
		t.Errorf("net pnl = %+v, want 325.50 USD", st.NetPnl)
	}
	if st.RTrades != 3 || round2(st.TotalR) != 2 || round2(st.AvgR) != 0.67 {
		t.Errorf("R = %d trades, %.2f total, %.2f avg; want 3, 2.00, 0.67", st.RTrades, st.TotalR, st.AvgR)
	}
	if st.Best == nil || st.Best.Name != "ORB" || st.Best.NetPnl != 500 || st.Best.Trades != 2 {
		t.Errorf("best = %+v", st.Best)
	}
	if st.Worst == nil || st.Worst.Name != "VWAP fade" || st.Worst.NetPnl != -150 {
		t.Errorf("worst = %+v", st.Worst)
	}
	// Two trades risked 100 against a 75 cap; the rest have no or lower risk.
	if !st.RulesSet || st.RuleBreaks != 2 {
		t.Errorf("rule breaks = %d (set %v), want 2", st.RuleBreaks, st.RulesSet)
	}
	if st.MissedTrades != 2 {
		t.Errorf("missed = %d, want 2", st.MissedTrades)
	}

	body := WeeklyNoteBody(st)
	for _, want := range []string{
		"- Net P&L: +$325.50",
		"- Trades: 6 (3 won, 2 lost)",
		"- Win rate: 50.0%",
		"- R: +2.00R total, +0.67R average (3 trades with risk set)",
		"- Best setup: ORB, +$500.00 over 2 trades",
		"- Worst setup: VWAP fade, -$150.00 over 1 trade",
		"- Rule breaks: 2",
		"- Missed trades: 2",
		"## What worked",
		"## What didn't",
		"## Focus for next week",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q:\n%s", want, body)
		}
	}

	ev := WeeklyEvent(st, "note-1")
	if ev.Title != "Weekly review: Sep 28 – Oct 4" {
		t.Errorf("event title = %q", ev.Title)
	}
	if ev.Body != "+$325.50 on 6 trades, 50.0% win rate, +2.00R. Tap to write your review." {
		t.Errorf("event body = %q", ev.Body)
	}
	if ev.Data["note_id"] != "note-1" || ev.Data["route"] != "/edit-note?id=note-1" ||
		ev.Data["type"] != RuleWeeklyReview || ev.Data["week_start"] != "2026-09-28" {
		t.Errorf("event data = %v", ev.Data)
	}
	if ev.DedupeKey != "2026-09-28" || ev.Rule != RuleWeeklyReview {
		t.Errorf("event rule/key = %s/%s", ev.Rule, ev.DedupeKey)
	}
}

func TestComputeWeeklyZeroTradeWeek(t *testing.T) {
	ny := mustLoc(t, "America/New_York")
	start := time.Date(2026, 9, 28, 0, 0, 0, 0, ny)
	st := ComputeWeekly(nil, analytics.ComplianceRules{}, nil, start, ny, "USD")
	if st.Trades != 0 || len(st.NetPnl) != 1 || st.NetPnl[0].Amount != 0 {
		t.Fatalf("zero week stats = %+v", st)
	}
	body := WeeklyNoteBody(st)
	for _, want := range []string{
		"- Net P&L: $0.00",
		"- Trades: 0 (0 won, 0 lost)",
		"- Win rate: 0.0%",
		"- R: no trades with risk set",
		"- Setups: none tagged",
		"- Rule breaks: no risk rules set",
		"- Missed trades: 0",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q:\n%s", want, body)
		}
	}
	ev := WeeklyEvent(st, "n")
	if ev.Body != "No trades this week. Tap to write your review." {
		t.Errorf("zero-week push body = %q", ev.Body)
	}
	for _, s := range []string{body, ev.Title, ev.Body} {
		if strings.Contains(s, "—") || strings.Contains(s, ": -\n") {
			t.Errorf("dash placeholder in %q", s)
		}
	}
}

func TestComputeWeeklySingleSetupAndMixedCurrency(t *testing.T) {
	hk := mustLoc(t, "Asia/Hong_Kong")
	start := time.Date(2026, 9, 28, 0, 0, 0, 0, hk)
	at := time.Date(2026, 9, 29, 11, 0, 0, 0, hk)
	trades := []WeeklyTrade{
		{NetPnl: 100, ClosedAt: at, Setup: "Breakout", Currency: "USD"},
		{NetPnl: 50, ClosedAt: at, Setup: "Breakout", Currency: "USD"},
		{NetPnl: -2000, ClosedAt: at, Setup: "Fade", Currency: "HKD"},
	}
	st := ComputeWeekly(trades, analytics.ComplianceRules{}, nil, start, hk, "USD")
	if len(st.NetPnl) != 2 || st.NetPnl[0].Currency != "USD" || st.NetPnl[1].Currency != "HKD" {
		t.Fatalf("currencies = %+v, want USD then HKD", st.NetPnl)
	}
	// Setups rank in the most-traded currency only: the HKD fade is left out.
	if st.Setups != 1 || st.Best.Name != "Breakout" {
		t.Errorf("setups = %d, best = %+v", st.Setups, st.Best)
	}
	body := WeeklyNoteBody(st)
	if !strings.Contains(body, "- Net P&L: +$150.00 / -HK$2,000.00") {
		t.Errorf("mixed-currency P&L line wrong:\n%s", body)
	}
	if !strings.Contains(body, "- Worst setup: only one setup traded") {
		t.Errorf("single-setup worst line wrong:\n%s", body)
	}
}

func TestFormatMoney(t *testing.T) {
	cases := map[string]string{
		formatMoney(1234567.891, "USD"): "+$1,234,567.89",
		formatMoney(-320, "usd"):        "-$320.00",
		formatMoney(0, "USD"):           "$0.00",
		formatMoney(-0.001, "USD"):      "$0.00",
		formatMoney(999.996, "EUR"):     "+€1,000.00",
		formatMoney(12.5, "SGD"):        "+12.50 SGD",
	}
	for got, want := range cases {
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
}
