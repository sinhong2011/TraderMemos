package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var (
	chased     = MistakeSource{Key: "tag:t1", Kind: MistakeKindTag, Label: "Chased"}
	overRisk   = MistakeSource{Key: "rule:" + RuleOverMaxRisk, Kind: MistakeKindRule, Label: "Over max risk"}
	revengeSrc = MistakeSource{Key: "behavior:revenge", Kind: MistakeKindBehavior, Label: "Revenge trade"}
)

func taxDay(d int) time.Time { return time.Date(2026, 9, d, 15, 0, 0, 0, time.UTC) }

func TestMistakeTaxCountsLossesOnlyAndOnce(t *testing.T) {
	trades := []TaxTrade{
		{ID: "a", NetPnl: -200, InitialRisk: 100, ClosedAt: taxDay(1)}, // chased + over risk
		{ID: "b", NetPnl: 150, InitialRisk: 100, ClosedAt: taxDay(2)},  // chased, but won
		{ID: "c", NetPnl: -100, ClosedAt: taxDay(3)},                   // revenge, no risk
		{ID: "d", NetPnl: 300, ClosedAt: taxDay(4)},                    // clean winner
		{ID: "e", NetPnl: -50, ClosedAt: taxDay(5)},                    // clean loser, unreviewed
		{ID: "f", NetPnl: -40, ClosedAt: taxDay(6), Reviewed: true},    // clean loser with a note
	}
	flags := map[string][]MistakeSource{
		"a": {chased, overRisk, chased}, // duplicate source is ignored
		"b": {chased},
		"c": {revengeSrc},
	}
	rep := MistakeTax(trades, flags, "week", time.UTC)

	require.Equal(t, 60.0, rep.PeriodNet)
	require.Equal(t, 390.0, rep.GrossLoss)
	require.Equal(t, 3, rep.FlaggedTrades)
	require.Equal(t, 300.0, rep.TotalCost) // a once (200) + c (100); b won, so 0
	require.Equal(t, 2.0, rep.TotalCostR)  // a = 2R; c has no risk
	require.Equal(t, 2, rep.RTrades)       // a and b carry risk
	require.Equal(t, 150.0, rep.LuckyWins)
	require.Equal(t, 210.0, rep.NetWithout) // 60 - (-200 + 150 - 100)
	require.Equal(t, 0.7692, rep.ShareOfLosses)
	require.Equal(t, 1, rep.UnreviewedLosses)
	require.Equal(t, []string{"e"}, rep.UnreviewedIDs)

	byKey := map[string]MistakeSourceRow{}
	for _, row := range rep.Sources {
		byKey[row.Key] = row
	}
	require.Equal(t, "tag:t1", rep.Sources[0].Key) // most expensive first
	require.Equal(t, 2, byKey["tag:t1"].Trades)
	require.Equal(t, 200.0, byKey["tag:t1"].Cost)
	require.Equal(t, 150.0, byKey["tag:t1"].Lucky)
	require.Equal(t, []string{"a", "b"}, byKey["tag:t1"].TradeIDs)
	require.Equal(t, 200.0, byKey["rule:"+RuleOverMaxRisk].Cost)
	require.Equal(t, 100.0, byKey["behavior:revenge"].Cost)
	require.Equal(t, 0.0, byKey["behavior:revenge"].CostR)
}

func TestMistakeTaxSeriesFillsEmptyWeeks(t *testing.T) {
	trades := []TaxTrade{
		{ID: "a", NetPnl: -100, ClosedAt: time.Date(2026, 9, 1, 15, 0, 0, 0, time.UTC)}, // Tue, week of Aug 31
		{ID: "b", NetPnl: 50, ClosedAt: time.Date(2026, 9, 9, 15, 0, 0, 0, time.UTC)},   // week of Sep 7, clean
		{ID: "c", NetPnl: -30, ClosedAt: time.Date(2026, 9, 16, 15, 0, 0, 0, time.UTC)}, // week of Sep 14
	}
	flags := map[string][]MistakeSource{"a": {chased}, "c": {chased}}
	rep := MistakeTax(trades, flags, "week", time.UTC)
	require.Equal(t, []MistakePeriod{
		{Period: "2026-08-31", Cost: 100},
		{Period: "2026-09-07", Cost: 0},
		{Period: "2026-09-14", Cost: 30},
	}, rep.Series)

	monthly := MistakeTax(trades, flags, "month", time.UTC)
	require.Equal(t, []MistakePeriod{{Period: "2026-09", Cost: 130}}, monthly.Series)
}

func TestMistakeTaxBucketsInMarketTimezone(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	// 02:00 UTC Monday Sep 7 is still Sunday Sep 6 in New York → week of Aug 31.
	trades := []TaxTrade{{ID: "a", NetPnl: -10, ClosedAt: time.Date(2026, 9, 7, 2, 0, 0, 0, time.UTC)}}
	rep := MistakeTax(trades, map[string][]MistakeSource{"a": {chased}}, "week", ny)
	require.Equal(t, "2026-08-31", rep.Series[0].Period)
}

func TestMistakeTaxEmpty(t *testing.T) {
	rep := MistakeTax(nil, nil, "week", time.UTC)
	require.Equal(t, 0.0, rep.TotalCost)
	require.Empty(t, rep.Sources)
	require.Empty(t, rep.Series)
	require.Equal(t, 0.0, rep.ShareOfLosses)
}

func TestComplianceViolationsPerTrade(t *testing.T) {
	day := func(h int) time.Time { return time.Date(2026, 9, 1, h, 0, 0, 0, time.UTC) }
	trades := []ComplianceTrade{
		{ID: "t1", NetPnl: -300, ClosedAt: day(14), InitialRisk: 500}, // over risk (max 200)
		{ID: "t2", NetPnl: -300, ClosedAt: day(15), InitialRisk: 100}, // crosses -500 daily loss
		{ID: "t3", NetPnl: 50, ClosedAt: day(16), InitialRisk: 100},   // past daily loss + past 2-loss streak + 3rd trade
		{ID: "t4", NetPnl: 20, ClosedAt: day(17), InitialRisk: 100},   // past daily loss, over trade limit
	}
	rep := Compliance(trades, ComplianceRules{
		MaxRiskPerTrade: 200, MaxDailyLoss: 500, MaxTradesPerDay: 2, MaxConsecutiveLosses: 2,
	}, time.UTC)
	require.Equal(t, []string{RuleOverMaxRisk}, rep.Violations["t1"])
	require.Empty(t, rep.Violations["t2"])
	require.ElementsMatch(t, []string{RuleOverTradeLimit, RulePastLossStreak, RulePastDailyLoss}, rep.Violations["t3"])
	require.ElementsMatch(t, []string{RuleOverTradeLimit, RulePastDailyLoss}, rep.Violations["t4"])
}
