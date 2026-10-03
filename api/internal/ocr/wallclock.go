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
// `YYYY-MM-DDTHH:MM:SS` wall-clock digits; resolveScreenZone then says which
// zone those digits are in, and the extract carries the exact instant.

var (
	// 2026-10-01 10:31[:25], 2026/10/01T10:31 — year first.
	wallYMD = regexp.MustCompile(`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]+(.+))?$`)
	// 10/01 10:31:25, 10/01/2026 10:31, 01/10/26 — year last or missing.
	wallMDY = regexp.MustCompile(`^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?(?:[T ]+(.+))?$`)
	// 10:31, 10:31:25, 9:31 AM, 21:05:00.123 — whatever follows (a zone
	// label like `(美東)`, an offset the model appended) is the tail.
	wallTime = regexp.MustCompile(`^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([AaPp][Mm])?(.*)$`)
)

// normalizeWallClock returns the fill time as `YYYY-MM-DDTHH:MM:SS` plus
// whatever trailed the time (`(美東)`, `-04:00`), or ok=false when raw has no
// recognisable date. A missing year is the latest one that doesn't put the
// fill in the future (a January scan of a December screenshot lands in
// December of last year). `now` should be the scan time.
func normalizeWallClock(raw string, now time.Time) (wall, tail string, ok bool) {
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
		return raw, "", false
	}
	if month < 1 || month > 12 || day < 1 || day > 31 {
		return raw, "", false
	}

	hour, minute, second := 0, 0, 0
	if rest = strings.TrimSpace(rest); rest != "" {
		t := wallTime.FindStringSubmatch(rest)
		if t == nil {
			return raw, "", false
		}
		hour, minute, second = atoi(t[1]), atoi(t[2]), atoi(t[3])
		tail = strings.TrimSpace(t[5])
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
			return raw, "", false
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
		return raw, "", false
	}
	return fmt.Sprintf("%04d-%02d-%02dT%02d:%02d:%02d", year, month, day, hour, minute, second), tail, true
}

// screenZones maps the labels broker screens print next to times to IANA
// zones. Keys are matched against a lower-cased, bracket-stripped label.
// Bare "CST" is left out on purpose: US Central or China Standard.
var screenZones = map[string]string{
	"美東": "America/New_York", "美东": "America/New_York", "美國東部": "America/New_York",
	"et": "America/New_York", "est": "America/New_York", "edt": "America/New_York",
	"eastern": "America/New_York", "us eastern": "America/New_York", "new york": "America/New_York",
	"美中": "America/Chicago", "cdt": "America/Chicago", "central": "America/Chicago", "us central": "America/Chicago",
	"美西": "America/Los_Angeles", "pt": "America/Los_Angeles", "pst": "America/Los_Angeles",
	"pdt": "America/Los_Angeles", "pacific": "America/Los_Angeles",
	"港": "Asia/Hong_Kong", "港時": "Asia/Hong_Kong", "香港": "Asia/Hong_Kong", "hkt": "Asia/Hong_Kong", "hong kong": "Asia/Hong_Kong",
	"北京": "Asia/Shanghai", "北京時間": "Asia/Shanghai", "北京时间": "Asia/Shanghai",
	"新加坡": "Asia/Singapore", "sgt": "Asia/Singapore", "singapore": "Asia/Singapore",
	"東京": "Asia/Tokyo", "东京": "Asia/Tokyo", "jst": "Asia/Tokyo", "tokyo": "Asia/Tokyo",
	"倫敦": "Europe/London", "bst": "Europe/London", "london": "Europe/London",
	"utc": "UTC", "gmt": "UTC", "z": "UTC",
}

// screenZone resolves a label the screen (or the model) gave for its times:
// an IANA name, a known abbreviation, or a numeric offset. nil when it isn't
// one — a guess here would move every fill.
func screenZone(label string) *time.Location {
	l := strings.TrimSpace(label)
	l = strings.Trim(l, "()（）[]【】 ")
	if l == "" {
		return nil
	}
	if strings.Contains(l, "/") {
		if loc, err := time.LoadLocation(l); err == nil {
			return loc
		}
	}
	if name, ok := screenZones[strings.ToLower(l)]; ok {
		loc, err := time.LoadLocation(name)
		if err == nil {
			return loc
		}
	}
	// "+08:00", "-0400", "UTC+8", "GMT-4"
	if m := zoneOffset.FindStringSubmatch(strings.ToUpper(l)); m != nil {
		hours, minutes := atoi(m[2]), atoi(m[3])
		if hours <= 14 && minutes < 60 {
			secs := hours*3600 + minutes*60
			if m[1] == "-" {
				secs = -secs
			}
			return time.FixedZone(l, secs)
		}
	}
	return nil
}

var zoneOffset = regexp.MustCompile(`^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$`)

func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
