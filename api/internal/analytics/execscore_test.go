package analytics

import (
	"testing"
	"time"
)

func fp(v float64) *float64 { return &v }

func est(id, symbol string, day, hour int, pnl, risk float64, mae, mfe *float64) ScoreTrade {
	opened := time.Date(2026, 7, day, hour, 0, 0, 0, time.UTC)
	return ScoreTrade{
		ID: id, Symbol: symbol,
		NetPnl:      pnl,
		OpenedAt:    opened,
		ClosedAt:    opened.Add(30 * time.Minute),
		InitialRisk: risk,
		Mae:         mae, Mfe: mfe,
	}
}

func TestExecScoreEmpty(t *testing.T) {
	rep := ExecScore(nil, ComplianceRules{}, DefaultExecScoreConfig(), time.UTC, "week")
	if rep.Trades != 0 || rep.Composite != nil || len(rep.Series) != 0 {
		t.Fatalf("empty input should score nothing: %+v", rep)
	}
}

func TestExecScoreEntryExitAxes(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	// Perfect entries (no heat), half the peak kept on exit.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 100, fp(0), fp(100)),
		est("b", "MSFT", 2, 10, 100, 100, fp(0), fp(200)),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Entry.Score == nil || *rep.Entry.Score != 100 {
		t.Fatalf("entry = %v, want 100", rep.Entry.Score)
	}
	if rep.Exit.Score == nil || *rep.Exit.Score != 50 {
		t.Fatalf("exit = %v, want 50", rep.Exit.Score)
	}
	if rep.Exit.Scored != 2 || rep.Entry.Scored != 2 {
		t.Fatalf("scored counts entry=%d exit=%d, want 2/2", rep.Entry.Scored, rep.Exit.Scored)
	}
}

func TestExecScoreEntryHeatRatio(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 1
	// MAE 50 against MFE 150 → entry = 1 - 50/200 = 75.
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 20, 100, fp(50), fp(150))}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Entry.Score == nil || *rep.Entry.Score != 75 {
		t.Fatalf("entry = %v, want 75", rep.Entry.Score)
	}
}

func TestExecScoreExitExcludesNeverGreen(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 1
	// Never green (MFE 0): excluded from Exit, not scored as 0.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, -80, 100, fp(120), fp(0)),
		est("b", "MSFT", 2, 10, 90, 100, fp(10), fp(100)),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Exit.Scored != 1 || rep.Exit.Excluded != 1 {
		t.Fatalf("exit scored=%d excluded=%d, want 1/1", rep.Exit.Scored, rep.Exit.Excluded)
	}
	if rep.Exit.Score == nil || *rep.Exit.Score != 90 {
		t.Fatalf("exit = %v, want 90", rep.Exit.Score)
	}
}

func TestExecScoreExitClampsAboveMfe(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 1
	// Net above recorded MFE clamps at 100 rather than overflowing.
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 120, 100, fp(0), fp(100))}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Exit.Score == nil || *rep.Exit.Score != 100 {
		t.Fatalf("exit = %v, want 100", rep.Exit.Score)
	}
}

func TestExecScoreRiskDisciplineOnlyWithoutRules(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 100, nil, nil), // risk recorded
		est("b", "MSFT", 2, 10, 50, 0, nil, nil),   // no risk recorded
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.RulesConfigured {
		t.Fatal("rules should not be configured")
	}
	if rep.Risk.Score == nil || *rep.Risk.Score != 50 {
		t.Fatalf("risk = %v, want 50 (half the trades journal risk)", rep.Risk.Score)
	}
}

func TestExecScoreRiskBlendsCompliance(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	rules := ComplianceRules{MaxRiskPerTrade: 100}
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 80, nil, nil),   // recorded + compliant → 1.0
		est("b", "MSFT", 2, 10, -60, 150, nil, nil), // recorded + violation → 0.5
	}
	rep := ExecScore(trades, rules, cfg, time.UTC, "week")
	if rep.Risk.Score == nil || *rep.Risk.Score != 75 {
		t.Fatalf("risk = %v, want 75", rep.Risk.Score)
	}
}

func TestExecScoreRiskDailyLossBreach(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	rules := ComplianceRules{MaxDailyLoss: 100}
	// Same day dips to -250 then recovers: both trades sit on a breach day
	// (recorded risk keeps the discipline half) → 0.5 each.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, -250, 50, nil, nil),
		est("b", "AAPL", 1, 14, 300, 50, nil, nil),
	}
	rep := ExecScore(trades, rules, cfg, time.UTC, "week")
	if rep.Risk.Score == nil || *rep.Risk.Score != 50 {
		t.Fatalf("risk = %v, want 50", rep.Risk.Score)
	}
}

func TestExecScoreTempoQuickReentry(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	opened := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	first := ScoreTrade{
		ID: "a", Symbol: "AAPL", NetPnl: -20, InitialRisk: 50,
		OpenedAt: opened, ClosedAt: opened.Add(10 * time.Minute),
	}
	// Re-enters the same symbol 5 minutes after the close.
	second := ScoreTrade{
		ID: "b", Symbol: "AAPL", NetPnl: 10, InitialRisk: 50,
		OpenedAt: opened.Add(15 * time.Minute), ClosedAt: opened.Add(45 * time.Minute),
	}
	rep := ExecScore([]ScoreTrade{first, second}, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Tempo.Score == nil || *rep.Tempo.Score != 50 {
		t.Fatalf("tempo = %v, want 50 (one of two trades flagged)", rep.Tempo.Score)
	}
}

func TestExecScoreTempoOvertradedDay(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 1
	cfg.QuickReentryWindow = 0 // isolate the overtrading detector
	var trades []ScoreTrade
	// Baseline days: one trade each on days 1–4 (distinct symbols, no re-entries).
	syms := []string{"AAPL", "MSFT", "NVDA", "AMD"}
	for i, sym := range syms {
		trades = append(trades, est(sym, sym, i+1, 10, 10, 50, nil, nil))
	}
	// Day 5 trades 5× the median of 1 → over 2× baseline, all five flagged.
	for i := 0; i < 5; i++ {
		trades = append(trades, est(string(rune('a'+i)), "TSLA", 5, 9+i, 10, 50, nil, nil))
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	// 4 of 9 trades unflagged → 44.4.
	if rep.Tempo.Score == nil || *rep.Tempo.Score != 44.4 {
		t.Fatalf("tempo = %v, want 44.4", rep.Tempo.Score)
	}
}

func TestExecScoreStabilityUsesRMultiples(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 4
	// R multiples 1, 1, 1, -1 → mean 0.5, stddev 1 → ratio 0.5 → 50+50*0.5/0.6·...
	// score = 100*clamp01(0.5 + 0.5/1.2) = 91.7
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 100, 100, nil, nil),
		est("b", "MSFT", 2, 10, 100, 100, nil, nil),
		est("c", "NVDA", 3, 10, 100, 100, nil, nil),
		est("d", "AMD", 4, 10, -100, 100, nil, nil),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Stability.Score == nil || *rep.Stability.Score != 91.7 {
		t.Fatalf("stability = %v, want 91.7", rep.Stability.Score)
	}
}

func TestExecScoreStabilityUndefinedWhenFlat(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	// Identical results: no dispersion information → undefined, not 100.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 100, nil, nil),
		est("b", "MSFT", 2, 10, 50, 100, nil, nil),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Stability.Score != nil {
		t.Fatalf("stability = %v, want nil", rep.Stability.Score)
	}
}

func TestExecScoreInsufficientDataIsNil(t *testing.T) {
	cfg := DefaultExecScoreConfig() // MinTrades 5
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 50, 100, fp(10), fp(100))}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Entry.Score != nil || rep.Exit.Score != nil || rep.Risk.Score != nil ||
		rep.Stability.Score != nil || rep.Tempo.Score != nil || rep.Composite != nil {
		t.Fatalf("one trade must leave every axis undefined: %+v", rep)
	}
	// The series bucket still reports its trade count even when unscored.
	if len(rep.Series) != 1 || rep.Series[0].Trades != 1 {
		t.Fatalf("series = %+v, want one bucket with 1 trade", rep.Series)
	}
}

func TestExecScoreCompositeRenormalizesWeights(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinTrades = 2
	// No MAE/MFE anywhere: Entry and Exit undefined; composite averages the
	// remaining defined axes only.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 100, 100, nil, nil),
		est("b", "MSFT", 2, 10, -50, 100, nil, nil),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if rep.Entry.Score != nil || rep.Exit.Score != nil {
		t.Fatalf("entry/exit should be undefined: %+v %+v", rep.Entry, rep.Exit)
	}
	if rep.Composite == nil {
		t.Fatal("composite should be defined from risk/stability/tempo")
	}
	// risk=100, stability defined, tempo=100 → weighted mean of the three.
	want := round1((*rep.Risk.Score*cfg.WeightRisk + *rep.Stability.Score*cfg.WeightStability + *rep.Tempo.Score*cfg.WeightTempo) / (cfg.WeightRisk + cfg.WeightStability + cfg.WeightTempo))
	if *rep.Composite != want {
		t.Fatalf("composite = %v, want %v", *rep.Composite, want)
	}
}

func TestExecScoreSeriesBuckets(t *testing.T) {
	cfg := DefaultExecScoreConfig()
	cfg.MinBucketTrades = 1
	cfg.MinTrades = 2
	// July 1 2026 is a Wednesday (week of Mon Jun 29); July 6 is the next Monday.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 100, fp(0), fp(100)),
		est("b", "MSFT", 6, 10, 80, 100, fp(20), fp(80)),
	}
	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	if len(rep.Series) != 2 {
		t.Fatalf("series len = %d, want 2", len(rep.Series))
	}
	if rep.Series[0].Date != "2026-06-29" || rep.Series[1].Date != "2026-07-06" {
		t.Fatalf("bucket dates = %s / %s", rep.Series[0].Date, rep.Series[1].Date)
	}
	if rep.Series[0].Entry == nil || *rep.Series[0].Entry != 100 {
		t.Fatalf("bucket entry = %v, want 100", rep.Series[0].Entry)
	}
	// Month bucketing collapses both into July… no: Jul 1 and Jul 6 share 2026-07-01.
	repM := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "month")
	if len(repM.Series) != 1 || repM.Series[0].Date != "2026-07-01" {
		t.Fatalf("month series = %+v", repM.Series)
	}
}
