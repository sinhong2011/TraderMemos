package money

import "math"

// Round2 rounds to 2 decimal places using round-half-away-from-zero.
func Round2(v float64) float64 {
	if v >= 0 {
		return math.Floor(v*100+0.5) / 100
	}
	return math.Ceil(v*100-0.5) / 100
}
