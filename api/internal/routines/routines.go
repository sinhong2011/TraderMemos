// Package routines schedules routine items onto calendar days and scores how
// much of each day's list was done. It works on local calendar days
// (YYYY-MM-DD strings sent by the client), never on timestamps, so "today"
// means the person's today wherever the server runs.
package routines

import (
	"regexp"
	"slices"
	"strings"
	"time"
)

const (
	StagePre    = "pre"
	StageDuring = "during"
	StagePost   = "post"
)

// Stages in the order a session runs; lists and summaries follow it.
var Stages = []string{StagePre, StageDuring, StagePost}

// ValidStage reports whether s is a known stage.
func ValidStage(s string) bool { return slices.Contains(Stages, s) }

func stageRank(s string) int {
	if i := slices.Index(Stages, s); i >= 0 {
		return i
	}
	return len(Stages)
}

// Weekday bitmask: Sunday = 1 << 0 ... Saturday = 1 << 6, time.Weekday order.
const (
	MonToFri = 0b0111110
	AllWeek  = 0b1111111
)

// MaskFromDays turns weekday numbers (0 = Sunday) into a bitmask, ignoring
// anything out of range.
func MaskFromDays(days []int) int64 {
	var mask int64
	for _, d := range days {
		if d >= 0 && d <= 6 {
			mask |= 1 << d
		}
	}
	return mask
}

// DaysFromMask is the inverse of MaskFromDays, ascending from Sunday.
func DaysFromMask(mask int64) []int {
	days := []int{}
	for d := range 7 {
		if mask&(1<<d) != 0 {
			days = append(days, d)
		}
	}
	return days
}

const dayLayout = "2006-01-02"

// ParseDay validates a YYYY-MM-DD calendar day.
func ParseDay(s string) (time.Time, bool) {
	t, err := time.Parse(dayLayout, s)
	return t, err == nil
}

// FormatDay renders t's calendar date as YYYY-MM-DD.
func FormatDay(t time.Time) string { return t.Format(dayLayout) }

// Item is the scheduling view of a routine item.
type Item struct {
	ID       string
	Stage    string
	Position int64
	Weekdays int64
	StartDay string
	EndDay   string // "" while active; archiving stops the item from EndDay on
}

// OnDay reports whether the item was on the list for day: its weekday is
// scheduled, it existed by then, and it had not been archived yet.
func (it Item) OnDay(day string) bool {
	t, ok := ParseDay(day)
	if !ok || it.Weekdays&(1<<int(t.Weekday())) == 0 {
		return false
	}
	if day < it.StartDay {
		return false
	}
	return it.EndDay == "" || day < it.EndDay
}

// Sort orders items by stage, then position.
func Sort(items []Item) {
	slices.SortStableFunc(items, func(a, b Item) int {
		if r := stageRank(a.Stage) - stageRank(b.Stage); r != 0 {
			return r
		}
		return int(a.Position - b.Position)
	})
}

// Checks indexes done items: day -> item id -> done.
type Checks map[string]map[string]bool

// Add records item as done on day.
func (c Checks) Add(day, itemID string) {
	if c[day] == nil {
		c[day] = map[string]bool{}
	}
	c[day][itemID] = true
}

// DayItems lists what counts on day: every item scheduled then, plus any item
// ticked that day off its schedule (a Saturday tick on a weekday item is still
// work done, so it counts rather than vanishing).
func DayItems(items []Item, checks Checks, day string) []Item {
	out := []Item{}
	for _, it := range items {
		if it.OnDay(day) || checks[day][it.ID] {
			out = append(out, it)
		}
	}
	Sort(out)
	return out
}

// Tally is done-out-of-total for one bucket.
type Tally struct {
	Total int `json:"total"`
	Done  int `json:"done"`
}

// DaySummary is one calendar day of the history.
type DaySummary struct {
	Day string `json:"day"`
	Tally
}

// History scores every day in [from, to], inclusive.
func History(items []Item, checks Checks, from, to string) []DaySummary {
	start, ok1 := ParseDay(from)
	end, ok2 := ParseDay(to)
	if !ok1 || !ok2 || end.Before(start) {
		return []DaySummary{}
	}
	out := []DaySummary{}
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		day := FormatDay(d)
		s := DaySummary{Day: day}
		for _, it := range DayItems(items, checks, day) {
			s.Total++
			if checks[day][it.ID] {
				s.Done++
			}
		}
		out = append(out, s)
	}
	return out
}

// ByStage totals history per stage, in stage order, over [from, to].
func ByStage(items []Item, checks Checks, from, to string) map[string]Tally {
	out := map[string]Tally{}
	for _, s := range Stages {
		out[s] = Tally{}
	}
	start, ok1 := ParseDay(from)
	end, ok2 := ParseDay(to)
	if !ok1 || !ok2 {
		return out
	}
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		day := FormatDay(d)
		for _, it := range DayItems(items, checks, day) {
			t := out[it.Stage]
			t.Total++
			if checks[day][it.ID] {
				t.Done++
			}
			out[it.Stage] = t
		}
	}
	return out
}

// CompletionRate is done / total across days that had a list; nil when none did.
func CompletionRate(days []DaySummary) *float64 {
	var total, done int
	for _, d := range days {
		total += d.Total
		done += d.Done
	}
	if total == 0 {
		return nil
	}
	r := float64(done) / float64(total)
	return &r
}

// Streak counts consecutive fully-done days ending at today. Days with no list
// (weekends on a weekday routine) neither count nor break it, and an unfinished
// today does not break it either: the day is still in progress.
func Streak(days []DaySummary, today string) int {
	streak := 0
	for i := len(days) - 1; i >= 0; i-- {
		d := days[i]
		if d.Day > today || d.Total == 0 {
			continue
		}
		if d.Done == d.Total {
			streak++
			continue
		}
		if d.Day == today {
			continue
		}
		break
	}
	return streak
}

// taskLine matches a markdown task: `- [x] text`.
var taskLine = regexp.MustCompile(`^\s*[-*+]\s+\[([ xX])\]\s*(.*?)\s*$`)

// DoneTasks returns the text of every ticked task in a markdown body, the
// lines the daily checklist used to write into a day's daily log.
func DoneTasks(body string) []string {
	out := []string{}
	for line := range strings.SplitSeq(body, "\n") {
		m := taskLine.FindStringSubmatch(line)
		if m != nil && m[1] != " " && m[2] != "" {
			out = append(out, m[2])
		}
	}
	return out
}
