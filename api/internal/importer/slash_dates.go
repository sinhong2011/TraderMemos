package importer

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var slashDatePrefix = regexp.MustCompile(`^(\d{1,2})/(\d{1,2})/(\d{2,4})\b`)

// Slash-date orders a file can be read in. DateOrderAmbiguous means every
// cell fits both orders differently (05/01/2026), so only the user can say.
const (
	DateOrderMonthFirst = "month_first"
	DateOrderDayFirst   = "day_first"
	DateOrderAmbiguous  = "ambiguous"
)

// DateOrderInfo is a file's slash-date order as the import preview reports it.
// Order is empty when the file has no slash dates at all. Example is the cell
// that settled the order, or for an ambiguous file one that reads differently
// each way; ExampleMonthFirst/ExampleDayFirst are its date (YYYY-MM-DD) under
// each order, empty where that order cannot parse it.
type DateOrderInfo struct {
	Order             string `json:"order"`
	Example           string `json:"example,omitempty"`
	ExampleMonthFirst string `json:"example_month_first,omitempty"`
	ExampleDayFirst   string `json:"example_day_first,omitempty"`
}

// DetectDateOrder decides a file's slash-date order from its timestamp cells.
// "05/01/2026" alone is ambiguous, so the order is settled file-wide: the first
// cell whose first part exceeds 12 proves day-first (13/01/2026), one whose
// second part exceeds 12 proves month-first (01/13/2026). A file with no proof
// is ambiguous only if some cell reads differently each way; one whose cells
// all read the same (01/01/2026) is month-first, since the order is moot.
//
// Reading cells one at a time instead would parse a DD/MM statement's early
// days of each month as the wrong month without any error.
func DetectDateOrder(values []string) DateOrderInfo {
	var info DateOrderInfo
	ambiguous := ""
	for _, v := range values {
		v = strings.TrimSpace(v)
		m := slashDatePrefix.FindStringSubmatch(v)
		if m == nil {
			continue
		}
		first, _ := strconv.Atoi(m[1])
		second, _ := strconv.Atoi(m[2])
		switch {
		case first > 12 && second <= 12:
			return withExamples(DateOrderInfo{Order: DateOrderDayFirst, Example: v})
		case second > 12 && first <= 12:
			return withExamples(DateOrderInfo{Order: DateOrderMonthFirst, Example: v})
		case first != second && ambiguous == "":
			ambiguous = v
		}
		info.Order = DateOrderMonthFirst
	}
	if ambiguous != "" {
		return withExamples(DateOrderInfo{Order: DateOrderAmbiguous, Example: ambiguous})
	}
	return info
}

func withExamples(info DateOrderInfo) DateOrderInfo {
	if t, err := parseTimeOrdered(info.Example, time.UTC, false); err == nil {
		info.ExampleMonthFirst = t.Format("2006-01-02")
	}
	if t, err := parseTimeOrdered(info.Example, time.UTC, true); err == nil {
		info.ExampleDayFirst = t.Format("2006-01-02")
	}
	return info
}

// DetectDayFirst reports whether a file's slash dates read DD/MM. An unproven
// file stays month-first, the US-broker convention every preset assumes.
func DetectDayFirst(values []string) bool {
	return DetectDateOrder(values).Order == DateOrderDayFirst
}

// ResolveDayFirst applies a user's explicit date order, falling back to
// detection when order is empty. It rejects anything but the two real orders.
func ResolveDayFirst(order string, values []string) (bool, error) {
	switch order {
	case "":
		return DetectDayFirst(values), nil
	case DateOrderDayFirst:
		return true, nil
	case DateOrderMonthFirst:
		return false, nil
	}
	return false, fmt.Errorf("invalid date order %q", order)
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
