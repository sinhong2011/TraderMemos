package analytics

import "time"

// ScalpMaxSecs is the upper bound (exclusive) for a same-day trade to count as a scalp.
const ScalpMaxSecs = 600

// DurationBucket classifies a closed trade by holding period, using the ET
// session clock for the calendar-day comparison:
//   - "swing": closed on a later ET calendar day than opened (held overnight)
//   - "scalp": same ET day and time in trade < ScalpMaxSecs
//   - "day":   same ET day and (>= ScalpMaxSecs, or duration unknown)
func DurationBucket(openedAt, closedAt time.Time, timeInTradeSecs *int64) string {
	o := openedAt.In(sessionLoc)
	c := closedAt.In(sessionLoc)
	if o.Year() != c.Year() || o.YearDay() != c.YearDay() {
		return "swing"
	}
	if timeInTradeSecs != nil && *timeInTradeSecs < ScalpMaxSecs {
		return "scalp"
	}
	return "day"
}
