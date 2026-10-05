package alerts

import (
	"encoding/json"
	"time"
)

// ReviewCutoffPref is the user-preferences key holding the dismissed review
// backlog: ungraded trades closed before it no longer count as unreviewed.
const ReviewCutoffPref = "reviewBacklogCutoff"

// Graded reports whether a trade_quality value marks the trade reviewed. A
// trade is reviewed once it has an execution grade; a lesson and mistake tags
// are optional.
func Graded(valid bool, quality int64) bool {
	return valid && quality > 0
}

// ReviewCutoff reads the dismissed-backlog cutoff out of the raw preferences
// JSON, nil when it was never dismissed or cannot be read.
func ReviewCutoff(prefs string) *time.Time {
	var m map[string]json.RawMessage
	if json.Unmarshal([]byte(prefs), &m) != nil {
		return nil
	}
	var raw string
	if json.Unmarshal(m[ReviewCutoffPref], &raw) != nil {
		return nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil
	}
	return &t
}

// ReviewTrade is a closed trade as the unreviewed rule sees it.
type ReviewTrade struct {
	ClosedAt time.Time
	Graded   bool
}

// CountUnreviewed counts ungraded trades closed before olderThan and not
// before the dismissed cutoff (nil = never dismissed) — the same trades the
// review inbox shows as queue or backlog.
func CountUnreviewed(trades []ReviewTrade, olderThan time.Time, cutoff *time.Time) int {
	n := 0
	for _, t := range trades {
		if t.Graded || !t.ClosedAt.Before(olderThan) {
			continue
		}
		if cutoff != nil && t.ClosedAt.Before(*cutoff) {
			continue
		}
		n++
	}
	return n
}
