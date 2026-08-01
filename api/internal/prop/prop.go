// Package prop evaluates a funded (prop-firm) account against its program
// rules: profit target, maximum drawdown, daily loss limit, and consistency.
package prop

import (
	"sort"
	"time"
)

// Settings are the program rules. Zero values mean "rule not set".
type Settings struct {
	ProfitTarget   float64
	MaxDrawdown    float64
	DrawdownMode   string // trailing | eod | static
	DailyLossLimit float64
	ConsistencyPct float64 // max share of total profit one day may contribute (0–1)
}

// Event is a realized change in account equity: a closed trade's net P&L or a
// cash transaction.
type Event struct {
	At     time.Time
	Amount float64
	Trade  bool // trades count toward profit target / daily loss; cash does not
}

// Status is the evaluated program state.
type Status struct {
	Equity        float64 `json:"equity"`
	StartBalance  float64 `json:"start_balance"`
	RealizedPnl   float64 `json:"realized_pnl"`
	TradingDays   int     `json:"trading_days"`
	ProfitTarget  float64 `json:"profit_target,omitempty"`
	TargetPct     float64 `json:"target_pct,omitempty"` // realized / target, clamped ≥ 0
	MaxDrawdown   float64 `json:"max_drawdown,omitempty"`
	DrawdownMode  string  `json:"drawdown_mode,omitempty"`
	EquityFloor   float64 `json:"equity_floor,omitempty"`
	FloorDistance float64 `json:"floor_distance,omitempty"` // equity − floor, current
	DrawdownHit   bool    `json:"drawdown_hit"`             // equity ever touched the floor
	DailyLossHits int     `json:"daily_loss_hits"`
	BestDayPnl    float64 `json:"best_day_pnl"`
	BestDayShare  float64 `json:"best_day_share,omitempty"` // best day / realized profit
	ConsistencyOk *bool   `json:"consistency_ok,omitempty"`
	TargetReached bool    `json:"target_reached"`
}

// Compute replays realized events chronologically. The drawdown floor follows
// the mode: "trailing" ratchets on every event's equity high-water mark,
// "eod" ratchets only on end-of-day equity, "static" stays at start − maxDD.
// Cash flows move equity (and therefore trailing watermarks) but do not count
// toward the profit target, daily loss, or consistency stats.
func Compute(startBalance float64, events []Event, s Settings, loc *time.Location) Status {
	if loc == nil {
		loc = time.UTC
	}
	evs := make([]Event, len(events))
	copy(evs, events)
	sort.SliceStable(evs, func(i, j int) bool { return evs[i].At.Before(evs[j].At) })

	st := Status{
		StartBalance: startBalance,
		ProfitTarget: s.ProfitTarget,
		MaxDrawdown:  s.MaxDrawdown,
		DrawdownMode: s.DrawdownMode,
	}

	equity := startBalance
	watermark := startBalance // trailing / eod high-water mark
	floor := func() float64 {
		switch s.DrawdownMode {
		case "static":
			return startBalance - s.MaxDrawdown
		default:
			return watermark - s.MaxDrawdown
		}
	}

	dayPnl := map[string]float64{}   // trades only, per local day
	dayRunning := map[string]float64{}
	dayBreached := map[string]bool{}
	lastDay := ""

	for _, e := range evs {
		day := e.At.In(loc).Format("2006-01-02")
		if s.DrawdownMode == "eod" && lastDay != "" && day != lastDay {
			if equity > watermark {
				watermark = equity
			}
		}
		lastDay = day

		equity += e.Amount
		if e.Trade {
			st.RealizedPnl += e.Amount
			dayPnl[day] += e.Amount
			dayRunning[day] += e.Amount
			if s.DailyLossLimit > 0 && dayRunning[day] < -s.DailyLossLimit {
				dayBreached[day] = true
			}
		}
		if s.MaxDrawdown > 0 && equity <= floor() {
			st.DrawdownHit = true
		}
		if s.DrawdownMode != "eod" && equity > watermark {
			watermark = equity
		}
	}
	if s.DrawdownMode == "eod" && equity > watermark {
		watermark = equity
	}

	st.Equity = equity
	st.TradingDays = len(dayPnl)
	for _, breached := range dayBreached {
		if breached {
			st.DailyLossHits++
		}
	}
	first := true
	for _, pnl := range dayPnl {
		if first || pnl > st.BestDayPnl {
			st.BestDayPnl = pnl
			first = false
		}
	}
	if s.MaxDrawdown > 0 {
		st.EquityFloor = floor()
		st.FloorDistance = equity - st.EquityFloor
	}
	if s.ProfitTarget > 0 {
		pct := st.RealizedPnl / s.ProfitTarget
		if pct < 0 {
			pct = 0
		}
		st.TargetPct = pct
		st.TargetReached = st.RealizedPnl >= s.ProfitTarget
	}
	if s.ConsistencyPct > 0 && st.RealizedPnl > 0 && st.BestDayPnl > 0 {
		st.BestDayShare = st.BestDayPnl / st.RealizedPnl
		ok := st.BestDayShare <= s.ConsistencyPct
		st.ConsistencyOk = &ok
	}
	return st
}
