package alerts

import (
	"strings"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/prop"
)

var nyc, _ = time.LoadLocation("America/New_York")

// now is 2026-08-07 15:00 ET.
var now = time.Date(2026, 8, 7, 19, 0, 0, 0, time.UTC)

func at(hour int) time.Time {
	return time.Date(2026, 8, 7, hour, 0, 0, 0, nyc)
}

func rulesOf(evs []Event) []string {
	out := make([]string, 0, len(evs))
	for _, e := range evs {
		out = append(out, e.Rule)
	}
	return out
}

func TestEvaluateRiskRule(t *testing.T) {
	cfg := Config{RiskEnabled: true, MaxRiskPerTrade: 500}
	trades := []Trade{
		{ID: "old", Symbol: "AAPL", NetPnl: 10, ClosedAt: now.AddDate(0, 0, -10), InitialRisk: 900},
		{ID: "fine", Symbol: "MSFT", NetPnl: 10, ClosedAt: at(10), InitialRisk: 400},
		{ID: "hot", Symbol: "TSLA", NetPnl: -50, ClosedAt: at(11), InitialRisk: 750},
		{ID: "norisk", Symbol: "NVDA", NetPnl: 5, ClosedAt: at(12)},
	}
	evs := Evaluate(cfg, trades, now, nyc)
	if len(evs) != 1 || evs[0].Rule != RuleRisk || evs[0].DedupeKey != "hot" {
		t.Fatalf("want one risk event for trade 'hot', got %+v", evs)
	}
	if !strings.Contains(evs[0].Body, "TSLA") {
		t.Errorf("body should name the symbol: %q", evs[0].Body)
	}
}

func TestEvaluateDailyLossRunningDip(t *testing.T) {
	cfg := Config{DailyLossEnabled: true, MaxDailyLoss: 500}
	// Dips to -600 intraday, finishes at -100: still a breach.
	trades := []Trade{
		{ID: "a", NetPnl: -600, ClosedAt: at(10)},
		{ID: "b", NetPnl: 500, ClosedAt: at(11)},
	}
	evs := Evaluate(cfg, trades, now, nyc)
	if len(evs) != 1 || evs[0].Rule != RuleDailyLoss {
		t.Fatalf("want daily loss breach, got %+v", evs)
	}
	if evs[0].DedupeKey != "2026-08-07" {
		t.Errorf("dedupe key should be the local day, got %q", evs[0].DedupeKey)
	}

	// Yesterday's blowup must not fire today.
	old := []Trade{{ID: "y", NetPnl: -900, ClosedAt: at(10).AddDate(0, 0, -1)}}
	if evs := Evaluate(cfg, old, now, nyc); len(evs) != 0 {
		t.Fatalf("yesterday's loss should not fire today: %+v", evs)
	}
}

func TestEvaluateDailyLossRespectsTimezone(t *testing.T) {
	cfg := Config{DailyLossEnabled: true, MaxDailyLoss: 100}
	// 23:00 UTC on Aug 6 is 19:00 Aug 6 in New York — but 08:00 Aug 7 in Tokyo.
	// Evaluated at 13:00 UTC Aug 7 (09:00 Aug 7 ET / 22:00 Aug 7 JST) the trade
	// is "today" in Tokyo and "yesterday" in New York.
	tokyo, _ := time.LoadLocation("Asia/Tokyo")
	tr := []Trade{{ID: "a", NetPnl: -200, ClosedAt: time.Date(2026, 8, 6, 23, 0, 0, 0, time.UTC)}}
	nowEval := time.Date(2026, 8, 7, 13, 0, 0, 0, time.UTC)
	if evs := Evaluate(cfg, tr, nowEval, tokyo); len(evs) != 1 {
		t.Fatalf("trade is today in Tokyo, want breach: %+v", evs)
	}
	if evs := Evaluate(cfg, tr, nowEval, nyc); len(evs) != 0 {
		t.Fatalf("trade is yesterday in New York, want none: %+v", evs)
	}
}

func TestEvaluateLossStreak(t *testing.T) {
	cfg := Config{LossStreakEnabled: true, LossStreakN: 3}
	trades := []Trade{
		{ID: "w", NetPnl: 100, ClosedAt: at(9)},
		{ID: "l1", NetPnl: -10, ClosedAt: at(10)},
		{ID: "l2", NetPnl: -10, ClosedAt: at(11)},
		{ID: "l3", NetPnl: -10, ClosedAt: at(12)},
	}
	evs := Evaluate(cfg, trades, now, nyc)
	if len(evs) != 1 || evs[0].Rule != RuleLossStreak {
		t.Fatalf("want streak event, got %+v", evs)
	}
	if !strings.Contains(evs[0].Title, "3") {
		t.Errorf("title should carry the count: %q", evs[0].Title)
	}

	// A trailing winner resets the streak.
	trades = append(trades, Trade{ID: "w2", NetPnl: 5, ClosedAt: at(13)})
	if evs := Evaluate(cfg, trades, now, nyc); len(evs) != 0 {
		t.Fatalf("winner should reset streak: %+v", evs)
	}
}

func TestEvaluateLossStreakStaleLastTrade(t *testing.T) {
	cfg := Config{LossStreakEnabled: true, LossStreakN: 2}
	// Streak exists but ended two days ago — no alert today.
	trades := []Trade{
		{ID: "l1", NetPnl: -10, ClosedAt: at(10).AddDate(0, 0, -2)},
		{ID: "l2", NetPnl: -10, ClosedAt: at(11).AddDate(0, 0, -2)},
	}
	if evs := Evaluate(cfg, trades, now, nyc); len(evs) != 0 {
		t.Fatalf("stale streak should not fire: %+v", evs)
	}
}

func TestEvaluateDisabledRulesSilent(t *testing.T) {
	cfg := Config{MaxRiskPerTrade: 1, MaxDailyLoss: 1, LossStreakN: 1} // thresholds set, rules off
	trades := []Trade{{ID: "a", NetPnl: -100, ClosedAt: at(10), InitialRisk: 50}}
	if evs := Evaluate(cfg, trades, now, nyc); len(evs) != 0 {
		t.Fatalf("disabled rules must stay silent: %+v", evs)
	}
}

func TestEvaluateProp(t *testing.T) {
	st := prop.Status{MaxDrawdown: 1000, FloorDistance: 150}
	evs := EvaluateProp("acc1", "Apex 50K", st, 0.8, "2026-08-07")
	if len(evs) != 1 || evs[0].Rule != RulePropDrawdown {
		t.Fatalf("85%% used should warn at 80%%: %+v", evs)
	}
	if evs[0].DedupeKey != "acc1|2026-08-07" {
		t.Errorf("warning dedupes per day: %q", evs[0].DedupeKey)
	}

	if evs := EvaluateProp("acc1", "Apex 50K", prop.Status{MaxDrawdown: 1000, FloorDistance: 500}, 0.8, "2026-08-07"); len(evs) != 0 {
		t.Fatalf("50%% used should not warn: %+v", evs)
	}

	hit := prop.Status{MaxDrawdown: 1000, FloorDistance: 0, DrawdownHit: true, EquityFloor: 49000}
	evs = EvaluateProp("acc1", "Apex 50K", hit, 0.8, "2026-08-07")
	if len(evs) != 1 || evs[0].DedupeKey != "acc1|hit" {
		t.Fatalf("breach fires once ever: %+v", evs)
	}

	if evs := EvaluateProp("acc1", "x", prop.Status{}, 0.8, "d"); len(evs) != 0 {
		t.Fatalf("no drawdown configured → silent: %+v", evs)
	}
}

func TestUnreviewed(t *testing.T) {
	evs := Unreviewed(12, 7, now, nyc)
	if len(evs) != 1 || evs[0].Rule != RuleUnreviewed {
		t.Fatalf("want unreviewed event, got %+v", evs)
	}
	if !strings.HasPrefix(evs[0].DedupeKey, "2026-W") {
		t.Errorf("dedupes per ISO week: %q", evs[0].DedupeKey)
	}
	if !strings.Contains(evs[0].Body, "12") || !strings.Contains(evs[0].Body, "7 days") {
		t.Errorf("body should carry count and window: %q", evs[0].Body)
	}
	if evs := Unreviewed(0, 7, now, nyc); len(evs) != 0 {
		t.Fatalf("zero unreviewed → silent: %+v", evs)
	}
}

func TestEvaluateCombined(t *testing.T) {
	cfg := Config{
		RiskEnabled: true, MaxRiskPerTrade: 100,
		DailyLossEnabled: true, MaxDailyLoss: 50,
		LossStreakEnabled: true, LossStreakN: 2,
	}
	trades := []Trade{
		{ID: "a", Symbol: "ES", NetPnl: -40, ClosedAt: at(10), InitialRisk: 200},
		{ID: "b", Symbol: "ES", NetPnl: -40, ClosedAt: at(11)},
	}
	evs := Evaluate(cfg, trades, now, nyc)
	got := rulesOf(evs)
	want := map[string]bool{RuleRisk: true, RuleDailyLoss: true, RuleLossStreak: true}
	if len(got) != 3 {
		t.Fatalf("want all three rules to fire, got %v", got)
	}
	for _, r := range got {
		if !want[r] {
			t.Errorf("unexpected rule %q", r)
		}
	}
}
