package analytics

import (
	"fmt"
	"time"
)

// US/Eastern is the default session clock for US equity day traders.
var sessionLoc = mustLoad("America/New_York")

func mustLoad(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.FixedZone("EST", -5*3600)
	}
	return loc
}

// SessionName buckets a timestamp into US equity sessions (ET).
// Premarket 04:00–09:29, RTH 09:30–15:59, Afterhours 16:00–19:59, Overnight otherwise.
func SessionName(t time.Time) string {
	local := t.In(sessionLoc)
	mins := local.Hour()*60 + local.Minute()
	switch {
	case mins >= 4*60 && mins < 9*60+30:
		return "Premarket"
	case mins >= 9*60+30 && mins < 16*60:
		return "RTH"
	case mins >= 16*60 && mins < 20*60:
		return "Afterhours"
	default:
		return "Overnight"
	}
}

// WeekdayName returns Monday..Sunday in the session timezone.
func WeekdayName(t time.Time) string {
	return t.In(sessionLoc).Weekday().String()
}

// HourBucket returns "HH:00" in the session timezone.
func HourBucket(t time.Time) string {
	return fmt.Sprintf("%02d:00", t.In(sessionLoc).Hour())
}
