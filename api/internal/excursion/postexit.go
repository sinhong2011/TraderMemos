package excursion

import (
	"math"
	"time"

	"github.com/tradermemos/api/internal/marketdata"
)

// PostExitResult reports price movement after the trade's exit, scaled to the
// position that was closed, as positive magnitudes in the P&L currency.
type PostExitResult struct {
	Mae      float64 // adverse-to-holding move the exit avoided
	Mfe      float64 // favorable continuation the exit gave up
	BarsUsed int
}

// PostExitBarCount is how many bars after the exit the post-exit window spans.
// Counting bars rather than wall-clock time makes the window "the next hour
// (or three sessions) of trading", so exits at the closing bell measure the
// next open instead of an empty overnight gap.
func PostExitBarCount(interval string) int {
	switch interval {
	case "1":
		return 60 // next trading hour
	case "5":
		return 12
	case "15":
		return 4
	case "60":
		return 7 // roughly one session
	default:
		return 3 // three daily sessions
	}
}

// PostExitFetchSlack is how far past the exit to request bars so the window
// above can fill even across a weekend or holiday break.
func PostExitFetchSlack(interval string) time.Duration {
	day := 24 * time.Hour
	switch interval {
	case "1", "5", "15":
		return 4 * day
	case "60":
		return 5 * day
	default:
		return 7 * day
	}
}

// ComputePostExit scans up to maxBars bars starting at or after the exit and
// measures the best and worst prices against the exit fill. For a long, Mfe is
// the run-up missed by selling (high − exit) and Mae the drop avoided
// (exit − low); shorts mirror. Returns ErrNoBars when no bar after the exit is
// available yet.
func ComputePostExit(
	bars []marketdata.Bar,
	exitAt time.Time,
	maxBars int,
	exitPrice float64,
	direction string,
	qty, mult float64,
) (PostExitResult, error) {
	if mult <= 0 {
		mult = 1
	}
	exitSec := exitAt.Unix()
	hi := math.Inf(-1)
	lo := math.Inf(1)
	used := 0
	for _, b := range bars {
		if b.Time < exitSec {
			continue
		}
		hi = math.Max(hi, b.High)
		lo = math.Min(lo, b.Low)
		used++
		if used >= maxBars {
			break
		}
	}
	if used == 0 {
		return PostExitResult{}, ErrNoBars
	}
	scale := qty * mult
	var mae, mfe float64
	if direction == "short" {
		mfe = (exitPrice - lo) * scale
		mae = (hi - exitPrice) * scale
	} else {
		mfe = (hi - exitPrice) * scale
		mae = (exitPrice - lo) * scale
	}
	return PostExitResult{
		Mae:      math.Max(0, mae),
		Mfe:      math.Max(0, mfe),
		BarsUsed: used,
	}, nil
}
