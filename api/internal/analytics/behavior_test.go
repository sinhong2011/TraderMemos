package analytics

import (
	"testing"
	"time"
)

var behaviorBase = time.Date(2026, 1, 5, 14, 30, 0, 0, time.UTC)

// bt builds a closed trade opened at behaviorBase+openMin that stays open for
// holdSecs. Size (notional) is qty × price.
func bt(id, sym string, qty, price, pnl float64, openMin int, holdSecs int64) BehaviorTrade {
	open := behaviorBase.Add(time.Duration(openMin) * time.Minute)
	return BehaviorTrade{
		ID:              id,
		Symbol:          sym,
		QtyOpened:       qty,
		AvgEntryPrice:   price,
		NetPnl:          pnl,
		OpenedAt:        open,
		ClosedAt:        open.Add(time.Duration(holdSecs) * time.Second),
		TimeInTradeSecs: holdSecs,
	}
}

func f(v float64) *float64 { return &v }

func TestBehaviorEmpty(t *testing.T) {
	rep := Behavior(nil, DefaultBehaviorConfig(), nil)
	if rep.Trades != 0 {
		t.Fatalf("Trades = %d, want 0", rep.Trades)
	}
	if !rep.Revenge.InsufficientData || !rep.Overconfidence.InsufficientData || !rep.LossAversion.InsufficientData {
		t.Fatal("empty input should report insufficient data everywhere")
	}
	if rep.Revenge.Events == nil || rep.Overconfidence.Events == nil || rep.LossAversion.GiveBacks == nil {
		t.Fatal("slices must be non-nil for JSON []")
	}
}

func TestBehaviorInsufficientDataFlag(t *testing.T) {
	trades := []BehaviorTrade{
		bt("a", "AAPL", 10, 10, 50, 0, 60),
		bt("b", "AAPL", 10, 10, -20, 120, 60),
	}
	rep := Behavior(trades, DefaultBehaviorConfig(), nil)
	if !rep.Revenge.InsufficientData {
		t.Fatal("2 trades should be insufficient with MinTrades=10")
	}
	if rep.Trades != 2 {
		t.Fatalf("Trades = %d, want 2", rep.Trades)
	}
}

func TestRevengeQuickReentry(t *testing.T) {
	// Loss on AAPL closes at +10m (opened 0, hold 600s); re-entry same symbol
	// at +15m — 5 minutes after the losing close.
	trades := []BehaviorTrade{
		bt("loss", "AAPL", 10, 10, -80, 0, 600),
		bt("re", "AAPL", 10, 10, 30, 15, 60),
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)

	if len(rep.Revenge.Events) != 1 {
		t.Fatalf("events = %d, want 1", len(rep.Revenge.Events))
	}
	ev := rep.Revenge.Events[0]
	if ev.TradeID != "re" || ev.TriggerTradeID != "loss" || ev.Reason != "quick_reentry" {
		t.Fatalf("unexpected event %+v", ev)
	}
	if ev.Date != "2026-01-05" {
		t.Fatalf("date = %q", ev.Date)
	}
	if rep.Revenge.Flagged.Trades != 1 || rep.Revenge.Baseline.Trades != 1 {
		t.Fatalf("split = %+v / %+v", rep.Revenge.Flagged, rep.Revenge.Baseline)
	}
}

func TestRevengeSizeEscalation(t *testing.T) {
	// Five spaced-out winners establish a 100-notional baseline, then a loss,
	// then a 3× sized entry on another symbol 30 minutes after the losing close.
	trades := []BehaviorTrade{
		bt("w1", "AAPL", 10, 10, 20, 0, 60),
		bt("w2", "AAPL", 10, 10, 20, 100, 60),
		bt("w3", "AAPL", 10, 10, 20, 200, 60),
		bt("w4", "AAPL", 10, 10, 20, 300, 60),
		bt("w5", "AAPL", 10, 10, 20, 400, 60),
		bt("loss", "AAPL", 10, 10, -50, 500, 600), // closes at +510m
		bt("big", "TSLA", 30, 10, -90, 540, 60),   // opens 30m after the loss closed
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)

	if len(rep.Revenge.Events) != 1 {
		t.Fatalf("events = %d, want 1: %+v", len(rep.Revenge.Events), rep.Revenge.Events)
	}
	ev := rep.Revenge.Events[0]
	if ev.TradeID != "big" || ev.Reason != "size_escalation" || ev.TriggerTradeID != "loss" {
		t.Fatalf("unexpected event %+v", ev)
	}
	if ev.SizeRatio < 2.9 || ev.SizeRatio > 3.1 {
		t.Fatalf("size ratio = %v, want ~3", ev.SizeRatio)
	}
	if rep.Revenge.Flagged.NetPnl != -90 {
		t.Fatalf("flagged pnl = %v", rep.Revenge.Flagged.NetPnl)
	}
}

func TestRevengeIgnoresOldAndWinningCloses(t *testing.T) {
	trades := []BehaviorTrade{
		bt("loss", "AAPL", 10, 10, -50, 0, 60),   // closes at +1m
		bt("late", "AAPL", 30, 10, 10, 120, 60),  // 2h later — outside window
		bt("win", "TSLA", 10, 10, 40, 300, 60),   // a winner closing…
		bt("after", "TSLA", 30, 10, 10, 305, 60), // …does not trigger revenge
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)
	if len(rep.Revenge.Events) != 0 {
		t.Fatalf("events = %+v, want none", rep.Revenge.Events)
	}
}

func TestOverconfidenceStreakInflation(t *testing.T) {
	// Three consecutive wins at 100 notional, then a 2× sized trade.
	trades := []BehaviorTrade{
		bt("w1", "AAPL", 10, 10, 20, 0, 60),
		bt("w2", "AAPL", 10, 10, 20, 10, 60),
		bt("w3", "AAPL", 10, 10, 20, 20, 60),
		bt("big", "AAPL", 20, 10, -60, 30, 60),
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)

	if rep.Overconfidence.Streaks != 1 {
		t.Fatalf("streaks = %d, want 1", rep.Overconfidence.Streaks)
	}
	if len(rep.Overconfidence.Events) != 1 {
		t.Fatalf("events = %d, want 1", len(rep.Overconfidence.Events))
	}
	ev := rep.Overconfidence.Events[0]
	if ev.TradeID != "big" || ev.SizeRatio != 2 {
		t.Fatalf("unexpected event %+v", ev)
	}
	if rep.Overconfidence.Flagged.Trades != 1 || rep.Overconfidence.Flagged.Wins != 0 {
		t.Fatalf("flagged = %+v", rep.Overconfidence.Flagged)
	}
}

func TestOverconfidenceNormalSizeNotFlagged(t *testing.T) {
	trades := []BehaviorTrade{
		bt("w1", "AAPL", 10, 10, 20, 0, 60),
		bt("w2", "AAPL", 10, 10, 20, 10, 60),
		bt("w3", "AAPL", 10, 10, 20, 20, 60),
		bt("same", "AAPL", 10, 10, 20, 30, 60),
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)
	if len(rep.Overconfidence.Events) != 0 {
		t.Fatalf("events = %+v, want none", rep.Overconfidence.Events)
	}
	if rep.Overconfidence.Streaks != 1 {
		t.Fatalf("streaks = %d, want 1 (streak of 4 counts once)", rep.Overconfidence.Streaks)
	}
}

func TestLossAversionHoldAndGiveBacks(t *testing.T) {
	w1 := bt("w1", "AAPL", 10, 10, 50, 0, 60)
	w2 := bt("w2", "AAPL", 10, 10, 30, 10, 60)
	gb := bt("gb", "TSLA", 10, 10, -40, 20, 600)
	gb.Mfe = f(120)
	noMfe := bt("nomfe", "TSLA", 10, 10, -25, 40, 600)
	flat := bt("flat", "MSFT", 10, 10, -10, 60, 600)
	flat.Mfe = f(0) // recorded, never green — not a give-back

	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior([]BehaviorTrade{w1, w2, gb, noMfe, flat}, cfg, nil)
	la := rep.LossAversion

	if la.AvgWinHoldSecs != 60 || la.AvgLossHoldSecs != 600 {
		t.Fatalf("holds = %v / %v", la.AvgWinHoldSecs, la.AvgLossHoldSecs)
	}
	if la.HoldRatio != 10 {
		t.Fatalf("hold ratio = %v, want 10", la.HoldRatio)
	}
	if la.GiveBackCount != 1 || la.MissedProfit != 120 {
		t.Fatalf("give-backs = %d missed = %v", la.GiveBackCount, la.MissedProfit)
	}
	if la.Excluded != 1 {
		t.Fatalf("excluded = %d, want 1", la.Excluded)
	}
	if len(la.GiveBacks) != 1 || la.GiveBacks[0].TradeID != "gb" {
		t.Fatalf("give-back list = %+v", la.GiveBacks)
	}
}

func TestLossAversionTopFiveTrimmed(t *testing.T) {
	var trades []BehaviorTrade
	for i := 0; i < 7; i++ {
		tr := bt(string(rune('a'+i)), "AAPL", 10, 10, -10, i*30, 60)
		tr.Mfe = f(float64(10 * (i + 1)))
		trades = append(trades, tr)
	}
	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior(trades, cfg, nil)
	la := rep.LossAversion

	if la.GiveBackCount != 7 {
		t.Fatalf("count = %d, want 7", la.GiveBackCount)
	}
	if len(la.GiveBacks) != maxGiveBacksListed {
		t.Fatalf("listed = %d, want %d", len(la.GiveBacks), maxGiveBacksListed)
	}
	if la.GiveBacks[0].Mfe != 70 {
		t.Fatalf("top give-back = %+v, want mfe 70 first", la.GiveBacks[0])
	}
	if la.MissedProfit != 10+20+30+40+50+60+70 {
		t.Fatalf("missed = %v", la.MissedProfit)
	}
}

func TestBehaviorDatesUseTraderTimezone(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Skip("tzdata unavailable")
	}
	// 01:00 UTC on Jan 6 is still Jan 5 in New York.
	loss := bt("loss", "AAPL", 10, 10, -50, 0, 60)
	loss.OpenedAt = time.Date(2026, 1, 6, 0, 30, 0, 0, time.UTC)
	loss.ClosedAt = time.Date(2026, 1, 6, 0, 50, 0, 0, time.UTC)
	re := bt("re", "AAPL", 10, 10, 20, 0, 60)
	re.OpenedAt = time.Date(2026, 1, 6, 1, 0, 0, 0, time.UTC)
	re.ClosedAt = time.Date(2026, 1, 6, 1, 5, 0, 0, time.UTC)

	cfg := DefaultBehaviorConfig()
	cfg.MinTrades = 1
	rep := Behavior([]BehaviorTrade{loss, re}, cfg, ny)
	if len(rep.Revenge.Events) != 1 {
		t.Fatalf("events = %d, want 1", len(rep.Revenge.Events))
	}
	if got := rep.Revenge.Events[0].Date; got != "2026-01-05" {
		t.Fatalf("date = %q, want 2026-01-05", got)
	}
}
