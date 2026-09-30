package importer

import (
	"regexp"
	"strconv"
	"strings"
)

var slashDatePrefix = regexp.MustCompile(`^(\d{1,2})/(\d{1,2})/(\d{2,4})\b`)

// DetectDayFirst decides a file's slash-date order from its timestamp cells.
// "05/01/2026" alone is ambiguous, so the order is settled file-wide: the first
// cell whose first part exceeds 12 proves day-first (13/01/2026), one whose
// second part exceeds 12 proves month-first (01/13/2026). An unproven file
// stays month-first, the US-broker convention every preset assumes.
//
// Reading cells one at a time instead would parse a DD/MM statement's early
// days of each month as the wrong month without any error.
func DetectDayFirst(values []string) bool {
	for _, v := range values {
		m := slashDatePrefix.FindStringSubmatch(strings.TrimSpace(v))
		if m == nil {
			continue
		}
		first, _ := strconv.Atoi(m[1])
		second, _ := strconv.Atoi(m[2])
		if first > 12 && second <= 12 {
			return true
		}
		if second > 12 && first <= 12 {
			return false
		}
	}
	return false
}

// Slash layouts in month-first order; dayFirstLayout swaps the date parts.
// Go's "1"/"2" accept one or two digits, so zero-padded cells match too.
var slashLayouts = []string{
	"1/2/2006 15:04:05",
	"1/2/2006 15:04",
	"1/2/2006 3:04:05 PM",
	"1/2/2006 3:04 PM",
	"1/2/06 15:04:05",
	"1/2/06 15:04",
	"1/2/06 3:04:05 PM",
	"1/2/06 3:04 PM",
	"1/2/2006",
}

func dayFirstLayout(layout string) string {
	date, rest, _ := strings.Cut(layout, " ")
	parts := strings.SplitN(date, "/", 3)
	parts[0], parts[1] = parts[1], parts[0]
	out := strings.Join(parts, "/")
	if rest != "" {
		out += " " + rest
	}
	return out
}
