// Package excursion computes MAE/MFE (maximum adverse / favorable excursion)
// for a trade by replaying its fills over OHLC bars.
package excursion

import (
	"errors"
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/marketdata"
)

// Fill is the minimal execution view needed to replay a position.
type Fill struct {
	Side       string // buy | sell
	Quantity   float64
	Price      float64
	Multiplier float64
	ExecutedAt time.Time
}

// Result reports excursion in the trade's P&L currency as positive magnitudes.
type Result struct {
	Mae      float64 // deepest open-equity dip below zero
	Mfe      float64 // highest open-equity peak above zero
	BarsUsed int     // bars evaluated while a position was open
}

var ErrNoBars = errors.New("no bars cover the trade window")

// Compute replays fills chronologically over bars, tracking running trade
// equity: realized gross P&L plus open P&L at each bar's high and low (and at
// every fill price, so entries and exits anchor the range). Fees are excluded —
// excursion describes price movement, matching how MAE/MFE are journaled by
// hand. Equity starts at zero when the position opens, so MFE/MAE are the
// max/min of that curve clamped at zero.
func Compute(bars []marketdata.Bar, interval string, fills []Fill) (Result, error) {
	if len(bars) == 0 {
		return Result{}, ErrNoBars
	}
	fs := make([]Fill, len(fills))
	copy(fs, fills)
	sort.SliceStable(fs, func(i, j int) bool { return fs[i].ExecutedAt.Before(fs[j].ExecutedAt) })

	barDur := IntervalDuration(interval)
	var (
		pos, avg, mult, realized float64
		minEq, maxEq             float64 // equity is 0 before the first fill
		barsUsed                 int
		fi                       int
	)
	mult = 1

	equityAt := func(price float64) float64 {
		return realized + (price-avg)*pos*mult
	}
	observe := func(eq float64) {
		minEq = math.Min(minEq, eq)
		maxEq = math.Max(maxEq, eq)
	}
	apply := func(f Fill) {
		m := f.Multiplier
		if m <= 0 {
			m = 1
		}
		q := f.Quantity
		if f.Side == "sell" {
			q = -q
		}
		switch {
		case pos == 0:
			pos, avg, mult = q, f.Price, m
		case (pos > 0) == (q > 0): // scale in — weighted-average cost
			avg = (avg*math.Abs(pos) + f.Price*math.Abs(q)) / (math.Abs(pos) + math.Abs(q))
			pos += q
		default: // reduce, close, or flip
			closed := math.Min(math.Abs(q), math.Abs(pos))
			sign := 1.0
			if pos < 0 {
				sign = -1
			}
			realized += (f.Price - avg) * sign * closed * mult
			pos += q
			if pos == 0 {
				avg = 0
			} else if (pos > 0) != (sign > 0) { // flipped through zero
				avg, mult = f.Price, m
			}
		}
		observe(equityAt(f.Price))
	}

	for _, b := range bars {
		barEnd := b.Time + int64(barDur/time.Second)
		for fi < len(fs) && fs[fi].ExecutedAt.Unix() < barEnd {
			apply(fs[fi])
			fi++
		}
		if pos == 0 {
			continue
		}
		observe(equityAt(b.High))
		observe(equityAt(b.Low))
		barsUsed++
	}
	// Fills after the last bar (e.g. an exit in a partially covered window)
	// still settle realized P&L and anchor the equity range.
	for ; fi < len(fs); fi++ {
		apply(fs[fi])
	}
	if barsUsed == 0 {
		return Result{}, ErrNoBars
	}
	return Result{
		Mae:      math.Max(0, -minEq),
		Mfe:      math.Max(0, maxEq),
		BarsUsed: barsUsed,
	}, nil
}

// ChooseInterval picks the finest bar size that the provider still retains for
// a trade of this age (Yahoo keeps ~30 days of 1m, ~60 days of 5m/15m, ~2
// years of hourly) without producing an unreasonable bar count for the hold.
func ChooseInterval(openedAt, closedAt, now time.Time) string {
	age := now.Sub(openedAt)
	hold := closedAt.Sub(openedAt)
	day := 24 * time.Hour
	switch {
	case age < 25*day && hold <= 2*day:
		return "1"
	case age < 55*day && hold <= 10*day:
		return "5"
	case age < 55*day && hold <= 30*day:
		return "15"
	case age < 700*day && hold <= 120*day:
		return "60"
	default:
		return "D"
	}
}

// IntervalDuration maps a chart interval token to its bar length.
func IntervalDuration(interval string) time.Duration {
	switch interval {
	case "1":
		return time.Minute
	case "5":
		return 5 * time.Minute
	case "15":
		return 15 * time.Minute
	case "60":
		return time.Hour
	case "240":
		return 4 * time.Hour
	default:
		return 24 * time.Hour
	}
}
