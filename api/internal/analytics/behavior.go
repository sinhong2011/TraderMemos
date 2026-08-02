package analytics

import (
	"sort"
	"time"
)

// BehaviorTrade is the per-trade view needed for behavioral pattern detection.
type BehaviorTrade struct {
	ID              string
	Symbol          string
	QtyOpened       float64
	AvgEntryPrice   float64
	NetPnl          float64
	OpenedAt        time.Time
	ClosedAt        time.Time
	TimeInTradeSecs int64    // 0 = unknown; ClosedAt−OpenedAt is used instead
	Mfe             *float64 // nil = not recorded
}

// BehaviorConfig tunes the detectors. DefaultBehaviorConfig is the only
// configuration in use today; the type exists so thresholds can become
// per-user settings without touching the detection code.
type BehaviorConfig struct {
	RevengeWindow      time.Duration // max gap between a losing close and a flagged open
	QuickReentryWindow time.Duration // same-symbol re-entry gap that flags on its own
	SizeEscalation     float64       // size ÷ baseline ratio that flags escalation
	StreakLen          int           // consecutive wins before the overconfidence check
	BaselineTrades     int           // trailing window for the median-size baseline
	MinBaseline        int           // fewer prior trades → compare against the trigger's size
	MinTrades          int           // fewer closed trades → sections report insufficient data
}

func DefaultBehaviorConfig() BehaviorConfig {
	return BehaviorConfig{
		RevengeWindow:      60 * time.Minute,
		QuickReentryWindow: 15 * time.Minute,
		SizeEscalation:     1.5,
		StreakLen:          3,
		BaselineTrades:     20,
		MinBaseline:        5,
		MinTrades:          10,
	}
}

// BehaviorEvent is one flagged trade with the evidence that flagged it.
type BehaviorEvent struct {
	Date           string  `json:"date"` // YYYY-MM-DD in the trader's timezone
	TradeID        string  `json:"trade_id"`
	Symbol         string  `json:"symbol"`
	TriggerTradeID string  `json:"trigger_trade_id,omitempty"`
	Reason         string  `json:"reason"` // "quick_reentry" | "size_escalation"
	SizeRatio      float64 `json:"size_ratio,omitempty"`
	NetPnl         float64 `json:"net_pnl"`
}

// OutcomeSplit compares how one group of trades performed.
type OutcomeSplit struct {
	Trades  int     `json:"trades"`
	Wins    int     `json:"wins"`
	WinRate float64 `json:"win_rate"` // 0–1; 0 when Trades is 0
	NetPnl  float64 `json:"net_pnl"`
}

// RevengeSection reports trades opened in the emotional wake of a loss.
type RevengeSection struct {
	InsufficientData bool            `json:"insufficient_data"`
	Events           []BehaviorEvent `json:"events"`
	Flagged          OutcomeSplit    `json:"flagged"`
	Baseline         OutcomeSplit    `json:"baseline"`
}

// OverconfidenceSection reports size inflation after win streaks.
type OverconfidenceSection struct {
	InsufficientData bool            `json:"insufficient_data"`
	Streaks          int             `json:"streaks"` // win streaks reaching StreakLen
	Events           []BehaviorEvent `json:"events"`
	Flagged          OutcomeSplit    `json:"flagged"`
	Baseline         OutcomeSplit    `json:"baseline"`
}

// GiveBack is a losing trade that was profitable at its peak.
type GiveBack struct {
	Date    string  `json:"date"` // YYYY-MM-DD close date in the trader's timezone
	TradeID string  `json:"trade_id"`
	Symbol  string  `json:"symbol"`
	Mfe     float64 `json:"mfe"`
	NetPnl  float64 `json:"net_pnl"`
}

// LossAversionSection reports hold-time asymmetry and given-back profits.
type LossAversionSection struct {
	InsufficientData   bool       `json:"insufficient_data"`
	AvgWinHoldSecs     float64    `json:"avg_win_hold_secs"`
	AvgLossHoldSecs    float64    `json:"avg_loss_hold_secs"`
	MedianWinHoldSecs  float64    `json:"median_win_hold_secs"`
	MedianLossHoldSecs float64    `json:"median_loss_hold_secs"`
	HoldRatio          float64    `json:"hold_ratio"` // loss avg ÷ win avg; 0 when undefined
	GiveBacks          []GiveBack `json:"give_backs"` // top offenders by peak profit
	GiveBackCount      int        `json:"give_back_count"`
	MissedProfit       float64    `json:"missed_profit"` // Σ MFE across all give-backs
	Excluded           int        `json:"excluded"`      // losers with no recorded MFE
}

// BehaviorReport is the payload for GET /analytics/behavior.
type BehaviorReport struct {
	Trades         int                   `json:"trades"`
	Revenge        RevengeSection        `json:"revenge"`
	Overconfidence OverconfidenceSection `json:"overconfidence"`
	LossAversion   LossAversionSection   `json:"loss_aversion"`
}

const maxGiveBacksListed = 5

// Behavior runs the three behavioral detectors over closed trades.
//
// Trade size is entry notional (qty × avg entry). Initial risk would be the
// better size metric but is too sparsely recorded to mix into a notional
// median, so it is not consulted. Revenge and overconfidence order trades by
// open time and close time respectively: sizing decisions happen at entry,
// while streak psychology follows realized outcomes.
func Behavior(trades []BehaviorTrade, cfg BehaviorConfig, loc *time.Location) BehaviorReport {
	if loc == nil {
		loc = time.UTC
	}
	insufficient := len(trades) < cfg.MinTrades

	rep := BehaviorReport{
		Trades:         len(trades),
		Revenge:        RevengeSection{InsufficientData: insufficient, Events: []BehaviorEvent{}},
		Overconfidence: OverconfidenceSection{InsufficientData: insufficient, Events: []BehaviorEvent{}},
		LossAversion:   LossAversionSection{InsufficientData: insufficient, GiveBacks: []GiveBack{}},
	}
	if len(trades) == 0 {
		return rep
	}

	byOpen := make([]BehaviorTrade, len(trades))
	copy(byOpen, trades)
	sort.SliceStable(byOpen, func(i, j int) bool { return byOpen[i].OpenedAt.Before(byOpen[j].OpenedAt) })
	byClose := make([]BehaviorTrade, len(trades))
	copy(byClose, trades)
	sort.SliceStable(byClose, func(i, j int) bool { return byClose[i].ClosedAt.Before(byClose[j].ClosedAt) })

	rep.Revenge = revenge(byOpen, cfg, loc)
	rep.Revenge.InsufficientData = insufficient
	rep.Overconfidence = overconfidence(byClose, cfg, loc)
	rep.Overconfidence.InsufficientData = insufficient
	rep.LossAversion = lossAversion(byClose, loc)
	rep.LossAversion.InsufficientData = insufficient
	return rep
}

func tradeSize(t BehaviorTrade) float64 { return t.QtyOpened * t.AvgEntryPrice }

func median(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	if n := len(s); n%2 == 1 {
		return s[n/2]
	} else {
		return (s[n/2-1] + s[n/2]) / 2
	}
}

func splitOutcomes(trades []BehaviorTrade, flagged map[string]bool) (in, out OutcomeSplit) {
	for _, t := range trades {
		dst := &out
		if flagged[t.ID] {
			dst = &in
		}
		dst.Trades++
		dst.NetPnl += t.NetPnl
		if t.NetPnl > 0 {
			dst.Wins++
		}
	}
	if in.Trades > 0 {
		in.WinRate = float64(in.Wins) / float64(in.Trades)
	}
	if out.Trades > 0 {
		out.WinRate = float64(out.Wins) / float64(out.Trades)
	}
	return in, out
}

// revenge flags trades opened shortly after a losing close, either as a quick
// same-symbol re-entry or with size escalated above the trailing median.
func revenge(byOpen []BehaviorTrade, cfg BehaviorConfig, loc *time.Location) RevengeSection {
	sec := RevengeSection{Events: []BehaviorEvent{}}
	flagged := make(map[string]bool)

	for i, t := range byOpen {
		var trigger *BehaviorTrade
		for j := range byOpen {
			c := &byOpen[j]
			if c.ID == t.ID || c.NetPnl >= 0 || c.ClosedAt.After(t.OpenedAt) {
				continue
			}
			if t.OpenedAt.Sub(c.ClosedAt) > cfg.RevengeWindow {
				continue
			}
			if trigger == nil || c.ClosedAt.After(trigger.ClosedAt) {
				trigger = c
			}
		}
		if trigger == nil {
			continue
		}

		ev := BehaviorEvent{
			Date:           t.OpenedAt.In(loc).Format("2006-01-02"),
			TradeID:        t.ID,
			Symbol:         t.Symbol,
			TriggerTradeID: trigger.ID,
			NetPnl:         t.NetPnl,
		}
		switch {
		case t.Symbol == trigger.Symbol && t.OpenedAt.Sub(trigger.ClosedAt) <= cfg.QuickReentryWindow:
			ev.Reason = "quick_reentry"
		default:
			base := trailingMedianSize(byOpen, i, cfg)
			if base <= 0 {
				base = tradeSize(*trigger)
			}
			if base <= 0 || tradeSize(t) < cfg.SizeEscalation*base {
				continue
			}
			ev.Reason = "size_escalation"
			ev.SizeRatio = tradeSize(t) / base
		}
		flagged[t.ID] = true
		sec.Events = append(sec.Events, ev)
	}

	sec.Flagged, sec.Baseline = splitOutcomes(byOpen, flagged)
	return sec
}

// trailingMedianSize is the median size of up to BaselineTrades trades opened
// before index i, or 0 when fewer than MinBaseline exist.
func trailingMedianSize(byOpen []BehaviorTrade, i int, cfg BehaviorConfig) float64 {
	lo := i - cfg.BaselineTrades
	if lo < 0 {
		lo = 0
	}
	if i-lo < cfg.MinBaseline {
		return 0
	}
	sizes := make([]float64, 0, i-lo)
	for _, p := range byOpen[lo:i] {
		sizes = append(sizes, tradeSize(p))
	}
	return median(sizes)
}

// overconfidence walks trades in realization order, tracking win streaks and
// flagging the next trade when its size jumps above the streak's median.
func overconfidence(byClose []BehaviorTrade, cfg BehaviorConfig, loc *time.Location) OverconfidenceSection {
	sec := OverconfidenceSection{Events: []BehaviorEvent{}}
	flagged := make(map[string]bool)
	streak := 0
	var streakSizes []float64

	for _, t := range byClose {
		if streak >= cfg.StreakLen {
			if med := median(streakSizes); med > 0 && tradeSize(t) >= cfg.SizeEscalation*med {
				flagged[t.ID] = true
				sec.Events = append(sec.Events, BehaviorEvent{
					Date:      t.OpenedAt.In(loc).Format("2006-01-02"),
					TradeID:   t.ID,
					Symbol:    t.Symbol,
					Reason:    "size_escalation",
					SizeRatio: tradeSize(t) / med,
					NetPnl:    t.NetPnl,
				})
			}
		}
		if t.NetPnl > 0 {
			if streak == 0 {
				streakSizes = streakSizes[:0]
			}
			streak++
			streakSizes = append(streakSizes, tradeSize(t))
			if streak == cfg.StreakLen {
				sec.Streaks++
			}
		} else {
			streak = 0
		}
	}

	sec.Flagged, sec.Baseline = splitOutcomes(byClose, flagged)
	return sec
}

// lossAversion measures hold-time asymmetry and losers that were green at
// their peak (recorded MFE > 0). Losers with no MFE are counted as excluded
// rather than silently treated as never-profitable.
func lossAversion(byClose []BehaviorTrade, loc *time.Location) LossAversionSection {
	sec := LossAversionSection{GiveBacks: []GiveBack{}}
	var winHolds, lossHolds []float64
	var all []GiveBack

	for _, t := range byClose {
		hold := float64(t.TimeInTradeSecs)
		if hold <= 0 {
			hold = t.ClosedAt.Sub(t.OpenedAt).Seconds()
		}
		switch {
		case t.NetPnl > 0:
			winHolds = append(winHolds, hold)
		case t.NetPnl < 0:
			lossHolds = append(lossHolds, hold)
			if t.Mfe == nil {
				sec.Excluded++
			} else if *t.Mfe > 0 {
				all = append(all, GiveBack{
					Date:    t.ClosedAt.In(loc).Format("2006-01-02"),
					TradeID: t.ID,
					Symbol:  t.Symbol,
					Mfe:     *t.Mfe,
					NetPnl:  t.NetPnl,
				})
				sec.MissedProfit += *t.Mfe
			}
		}
	}

	sec.AvgWinHoldSecs = mean(winHolds)
	sec.AvgLossHoldSecs = mean(lossHolds)
	sec.MedianWinHoldSecs = median(winHolds)
	sec.MedianLossHoldSecs = median(lossHolds)
	if sec.AvgWinHoldSecs > 0 {
		sec.HoldRatio = sec.AvgLossHoldSecs / sec.AvgWinHoldSecs
	}
	sec.GiveBackCount = len(all)
	sort.SliceStable(all, func(i, j int) bool { return all[i].Mfe > all[j].Mfe })
	if len(all) > maxGiveBacksListed {
		all = all[:maxGiveBacksListed]
	}
	sec.GiveBacks = append(sec.GiveBacks, all...)
	return sec
}

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	var sum float64
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}
