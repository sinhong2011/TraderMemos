package ocr

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Broker screens print fill times however they like, and the vision prompt
// asks for them verbatim (converting would invent a zone). The clients only
// read `YYYY-MM-DD[T ]HH:MM[:SS]`, though — anything else fell back to "now",
// silently moving every fill to the day it was scanned. Futu's history list,
// for one, shows `10/01 10:31:25`: month/day, no year.
//
// normalizeWallClock rewrites the shapes brokers actually use into
// `YYYY-MM-DDTHH:MM:SS` without touching the digits' zone: it is still the
// screen's wall clock, which the client interprets the way it always has.

var (
	// 2026-10-01 10:31[:25], 2026/10/01T10:31 — year first.
	wallYMD = regexp.MustCompile(`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]+(.+))?$`)
	// 10/01 10:31:25, 10/01/2026 10:31, 01/10/26 — year last or missing.
	wallMDY = regexp.MustCompile(`^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?(?:[T ]+(.+))?$`)
	// 10:31, 10:31:25, 9:31 AM, 21:05:00.123 — anything after the seconds
	// (fractions, a zone the model appended) is dropped.
	wallTime = regexp.MustCompile(`^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([AaPp][Mm])?`)
)

// normalizeWallClock returns the fill time as `YYYY-MM-DDTHH:MM:SS`, or ok=false
// when raw has no recognisable date. A missing year is the latest one that
// doesn't put the fill in the future (a January scan of a December screenshot
// lands in December of last year). `now` should be the scan time.
func normalizeWallClock(raw string, now time.Time) (string, bool) {
	// A zone the model appended despite the prompt (`Z`, `+08:00`, `(美東)`)
	// trails the time, and wallTime only reads the time's prefix — the
	// digits are the screen's, the offset is fiction.
	s := strings.TrimSpace(raw)

	var year, month, day int
	var rest string
	yearKnown := true
	if m := wallYMD.FindStringSubmatch(s); m != nil {
		year, month, day, rest = atoi(m[1]), atoi(m[2]), atoi(m[3]), m[4]
	} else if m := wallMDY.FindStringSubmatch(s); m != nil {
		a, b := atoi(m[1]), atoi(m[2])
		// US brokers (and Futu's US view) print month first. Day-first only
		// when the first number can't be a month.
		month, day = a, b
		if a > 12 && b <= 12 {
			month, day = b, a
		}
		switch len(m[3]) {
		case 4:
			year = atoi(m[3])
		case 2:
			year = 2000 + atoi(m[3])
		default:
			yearKnown = false
		}
		rest = m[4]
	} else {
		return raw, false
	}
	if month < 1 || month > 12 || day < 1 || day > 31 {
		return raw, false
	}

	hour, minute, second := 0, 0, 0
	if rest = strings.TrimSpace(rest); rest != "" {
		t := wallTime.FindStringSubmatch(rest)
		if t == nil {
			return raw, false
		}
		hour, minute, second = atoi(t[1]), atoi(t[2]), atoi(t[3])
		switch strings.ToLower(t[4]) {
		case "pm":
			if hour < 12 {
				hour += 12
			}
		case "am":
			if hour == 12 {
				hour = 0
			}
		}
		if hour > 23 || minute > 59 || second > 59 {
			return raw, false
		}
	}

	if !yearKnown {
		year = now.Year()
		// Two days of slack: the screen's zone can sit a day ahead of the
		// server's, and today's fills must not roll back a year.
		if time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC).After(now.AddDate(0, 0, 2)) {
			year--
		}
	}
	// time.Date normalises 02-30 into March; a date that moves isn't one.
	d := time.Date(year, time.Month(month), day, hour, minute, second, 0, time.UTC)
	if d.Month() != time.Month(month) || d.Day() != day {
		return raw, false
	}
	return fmt.Sprintf("%04d-%02d-%02dT%02d:%02d:%02d", year, month, day, hour, minute, second), true
}

func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
