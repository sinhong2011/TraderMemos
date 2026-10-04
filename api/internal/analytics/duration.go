package analytics

import "time"

// ScalpMaxSecs is the upper bound (exclusive) for a same-day trade to count as a scalp.
const ScalpMaxSecs = 600

// DefaultMarketTZ is the trading-day clock for duration bucketing when the
// request names no market timezone (`tz` query param absent).
const DefaultMarketTZ = "America/New_York"

var defaultMarketLoc = mustLoad(DefaultMarketTZ)

// DurationBucket classifies a closed trade by holding period, comparing
// calendar days on the trader's market clock loc (nil = America/New_York):
//   - "swing": closed on a later market-tz calendar day than opened (held overnight)
//   - "scalp": same market-tz day and time in trade < ScalpMaxSecs
//   - "day":   same market-tz day and (>= ScalpMaxSecs, or duration unknown)
func DurationBucket(openedAt, closedAt time.Time, timeInTradeSecs *int64, loc *time.Location) string {
	if loc == nil {
		loc = defaultMarketLoc
	}
	o := openedAt.In(loc)
	c := closedAt.In(loc)
	if o.Year() != c.Year() || o.YearDay() != c.YearDay() {
		return "swing"
	}
	if timeInTradeSecs != nil && *timeInTradeSecs < ScalpMaxSecs {
		return "scalp"
	}
	return "day"
}
