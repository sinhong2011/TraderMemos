package prop

import (
	"testing"
	"time"
)

func ev(day, hour int, amount float64, trade bool) Event {
	return Event{At: time.Date(2026, 7, day, hour, 0, 0, 0, time.UTC), Amount: amount, Trade: trade}
}

func TestComputeTrailingDrawdown(t *testing.T) {
	s := Settings{MaxDrawdown: 2000, DrawdownMode: "trailing"}
	// 50k start → +1500 (wm 51.5k, floor 49.5k) → −1900 dips to 49.6k (no hit)
	events := []Event{
		ev(1, 10, 1500, true),
		ev(2, 10, -1900, true),
	}
	st := Compute(50_000, events, s, time.UTC)
	if st.DrawdownHit {
		t.Fatal("floor should not be hit at 49.6k vs 49.5k floor")
	}
	if st.EquityFloor != 49_500 {
		t.Fatalf("floor = %v, want 49500", st.EquityFloor)
	}
	if st.FloorDistance != 100 {
		t.Fatalf("distance = %v, want 100", st.FloorDistance)
	}
	// One more small loss crosses the trailing floor.
	st = Compute(50_000, append(events, ev(3, 10, -150, true)), s, time.UTC)
	if !st.DrawdownHit {
		t.Fatal("floor should be hit after the extra loss")
	}
}

func TestComputeStaticVsTrailing(t *testing.T) {
	events := []Event{
		ev(1, 10, 3000, true),  // 53k
		ev(2, 10, -4000, true), // 49k
	}
	trailing := Compute(50_000, events, Settings{MaxDrawdown: 2000, DrawdownMode: "trailing"}, time.UTC)
	static := Compute(50_000, events, Settings{MaxDrawdown: 2000, DrawdownMode: "static"}, time.UTC)
	if !trailing.DrawdownHit {
		t.Fatal("trailing floor 51k should be hit at 49k")
	}
	if static.DrawdownHit {
		t.Fatal("static floor 48k should not be hit at 49k")
	}
}

func TestComputeEodWatermarkIgnoresIntradayHigh(t *testing.T) {
	s := Settings{MaxDrawdown: 1000, DrawdownMode: "eod"}
	// Day 1: +2000 intraday then −1500 → EOD 50.5k. Day 2: −400 → 50.1k.
	// EOD watermark is 50.5k (floor 49.5k); intraday 52k never ratchets.
	events := []Event{
		ev(1, 10, 2000, true),
		ev(1, 14, -1500, true),
		ev(2, 10, -400, true),
	}
	st := Compute(50_000, events, s, time.UTC)
	if st.DrawdownHit {
		t.Fatal("eod floor should not be hit")
	}
	if st.EquityFloor != 49_500 {
		t.Fatalf("floor = %v, want 49500 (eod watermark 50.5k)", st.EquityFloor)
	}
}

func TestComputeProfitTargetAndConsistency(t *testing.T) {
	s := Settings{ProfitTarget: 3000, ConsistencyPct: 0.5}
	events := []Event{
		ev(1, 10, 2000, true),
		ev(2, 10, 500, true),
		ev(3, 10, 700, true),
	}
	st := Compute(50_000, events, s, time.UTC)
	if !st.TargetReached {
		t.Fatalf("3200 realized should reach 3000 target (pct %v)", st.TargetPct)
	}
	if st.ConsistencyOk == nil || *st.ConsistencyOk {
		t.Fatalf("best day 2000/3200 = 62%% should fail a 50%% consistency rule")
	}
}

func TestComputeDailyLossAndCashExclusion(t *testing.T) {
	s := Settings{DailyLossLimit: 500, ProfitTarget: 1000}
	events := []Event{
		ev(1, 9, 10_000, false), // deposit: moves equity, not stats
		ev(1, 10, -600, true),   // breaches daily loss
		ev(1, 12, 700, true),    // recovers, breach still counted
		ev(2, 10, -100, true),
	}
	st := Compute(50_000, events, s, time.UTC)
	if st.DailyLossHits != 1 {
		t.Fatalf("daily loss hits = %d, want 1", st.DailyLossHits)
	}
	if st.RealizedPnl != 0 {
		t.Fatalf("realized = %v, want 0 (deposit excluded)", st.RealizedPnl)
	}
	if st.Equity != 60_000 {
		t.Fatalf("equity = %v, want 60000", st.Equity)
	}
	if st.TradingDays != 2 {
		t.Fatalf("trading days = %d, want 2", st.TradingDays)
	}
}
