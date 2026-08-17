package analytics

import (
	"testing"
	"time"
)

func ct(day int, hour int, pnl, risk float64) ComplianceTrade {
	return ComplianceTrade{
		NetPnl:      pnl,
		ClosedAt:    time.Date(2026, 7, day, hour, 0, 0, 0, time.UTC),
		InitialRisk: risk,
	}
}

func TestComplianceNoRules(t *testing.T) {
	rep := Compliance([]ComplianceTrade{ct(1, 10, 100, 50)}, ComplianceRules{}, time.UTC)
	if rep.RulesConfigured {
		t.Fatal("rules should not be configured")
	}
	if len(rep.Days) != 0 {
		t.Fatalf("days = %d, want 0", len(rep.Days))
	}
}

func TestComplianceRiskViolations(t *testing.T) {
	rules := ComplianceRules{MaxRiskPerTrade: 100}
	trades := []ComplianceTrade{
		ct(1, 10, 50, 80),   // ok
		ct(1, 11, -60, 150), // over-risked
		ct(2, 10, 40, 0),    // unknown risk
	}
	rep := Compliance(trades, rules, time.UTC)
	if rep.RiskViolations != 1 || rep.UnknownRisk != 1 {
		t.Fatalf("violations=%d unknown=%d, want 1/1", rep.RiskViolations, rep.UnknownRisk)
	}
	if rep.CompliantDays != 1 || rep.BreachDays != 1 {
		t.Fatalf("compliant=%d breach=%d, want 1/1", rep.CompliantDays, rep.BreachDays)
	}
	// Day 1 broke a rule and lost money net; day 2 followed rules.
	if rep.BreachPnl != -10 || rep.CompliantPnl != 40 {
		t.Fatalf("breachPnl=%v compliantPnl=%v", rep.BreachPnl, rep.CompliantPnl)
	}
}

func TestComplianceDailyLossIntradayDip(t *testing.T) {
	rules := ComplianceRules{MaxDailyLoss: 200}
	// Dips to -250 intraday, recovers to +50: still a breach.
	trades := []ComplianceTrade{
		ct(1, 10, -250, 0),
		ct(1, 12, 300, 0),
	}
	rep := Compliance(trades, rules, time.UTC)
	if len(rep.Days) != 1 || !rep.Days[0].DailyLossBreach {
		t.Fatalf("expected daily loss breach, got %+v", rep.Days)
	}
	if rep.DailyLossBreaches != 1 || rep.BreachPnl != 50 {
		t.Fatalf("breaches=%d breachPnl=%v", rep.DailyLossBreaches, rep.BreachPnl)
	}
}

func TestComplianceTradeLimit(t *testing.T) {
	rules := ComplianceRules{MaxTradesPerDay: 2}
	trades := []ComplianceTrade{
		ct(1, 10, 50, 0),
		ct(1, 11, -20, 0),
		ct(1, 12, 30, 0), // third trade of the day — over the limit
		ct(2, 10, 40, 0),
	}
	rep := Compliance(trades, rules, time.UTC)
	if !rep.RulesConfigured {
		t.Fatal("trade limit alone should configure the rules")
	}
	if len(rep.Days) != 2 || !rep.Days[0].TradeLimitBreach || rep.Days[1].TradeLimitBreach {
		t.Fatalf("expected day 1 over the limit only, got %+v", rep.Days)
	}
	if rep.TradeLimitBreaches != 1 {
		t.Fatalf("tradeLimitBreaches=%d, want 1", rep.TradeLimitBreaches)
	}
	if rep.CompliantDays != 1 || rep.BreachDays != 1 {
		t.Fatalf("compliant=%d breach=%d, want 1/1", rep.CompliantDays, rep.BreachDays)
	}
	if rep.BreachPnl != 60 || rep.CompliantPnl != 40 {
		t.Fatalf("breachPnl=%v compliantPnl=%v", rep.BreachPnl, rep.CompliantPnl)
	}
}

func TestComplianceDailyLossNotBreached(t *testing.T) {
	rules := ComplianceRules{MaxDailyLoss: 200}
	trades := []ComplianceTrade{
		ct(1, 10, -150, 0),
		ct(1, 12, 100, 0),
	}
	rep := Compliance(trades, rules, time.UTC)
	if rep.DailyLossBreaches != 0 || rep.CompliantDays != 1 {
		t.Fatalf("unexpected breach: %+v", rep)
	}
}

func TestComplianceTimezoneDayKey(t *testing.T) {
	ny, _ := time.LoadLocation("America/New_York")
	rules := ComplianceRules{MaxDailyLoss: 100}
	// 2026-07-02 01:00 UTC is still 2026-07-01 in New York.
	trades := []ComplianceTrade{
		{NetPnl: -80, ClosedAt: time.Date(2026, 7, 1, 20, 0, 0, 0, time.UTC)},
		{NetPnl: -80, ClosedAt: time.Date(2026, 7, 2, 1, 0, 0, 0, time.UTC)},
	}
	rep := Compliance(trades, rules, ny)
	if len(rep.Days) != 1 {
		t.Fatalf("days = %d, want 1 (same NY day)", len(rep.Days))
	}
	if !rep.Days[0].DailyLossBreach {
		t.Fatal("running -160 should breach the 100 limit")
	}
}
