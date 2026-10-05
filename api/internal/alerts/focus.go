package alerts

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/store"
)

// MaxFocusItems caps a week's focus: more than three is a to-do list, not a focus.
const MaxFocusItems = 3

// focusLookback is how far back the previous review may sit. A review skipped
// for a week leaves no focus rather than reviving a stale one.
const focusLookback = 14

var (
	focusHeading = regexp.MustCompile(`(?i)^#{1,6}\s*focus for next week\b`)
	anyHeading   = regexp.MustCompile(`^#{1,6}\s`)
	focusBullet  = regexp.MustCompile(`^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$`)
)

// ParseFocus reads the bullet items under the "Focus for next week" heading of
// a weekly review note — the owner's own words, up to MaxFocusItems. Plain
// lines under the heading are ignored: only list items count as commitments.
func ParseFocus(body string) []string {
	var out []string
	in := false
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case focusHeading.MatchString(trimmed):
			in = true
			continue
		case in && anyHeading.MatchString(trimmed):
			return out
		}
		if !in {
			continue
		}
		if m := focusBullet.FindStringSubmatch(line); m != nil {
			out = append(out, m[1])
			if len(out) == MaxFocusItems {
				return out
			}
		}
	}
	return out
}

// NotesReader lists journal notes by occurred-at date.
type NotesReader interface {
	ListJournalNotes(ctx context.Context, arg store.ListJournalNotesParams) ([]store.JournalNote, error)
}

// PreviousFocus returns the focus set by the latest weekly review dated before
// weekStart (within two weeks), and that note. Generated and hand-written
// reviews both count: the note type is the signal. No review → nil, nil.
func PreviousFocus(ctx context.Context, q NotesReader, userID string, weekStart time.Time) ([]string, *store.JournalNote, error) {
	notes, err := q.ListJournalNotes(ctx, store.ListJournalNotesParams{
		UserID:   userID,
		FromDate: weekStart.AddDate(0, 0, -focusLookback).Format("2006-01-02"),
		ToDate:   weekStart.AddDate(0, 0, -1).Format("2006-01-02"),
	})
	if err != nil {
		return nil, nil, err
	}
	// Newest first (the query orders by occurred_at, then created_at).
	for i := range notes {
		if notes[i].NoteType == NoteTypeWeeklyReview {
			return ParseFocus(notes[i].Body), &notes[i], nil
		}
	}
	return nil, nil, nil
}

var (
	lastFocusHeading = regexp.MustCompile(`(?i)^#{1,6}\s*last week'?s focus\b`)
	checkItem        = regexp.MustCompile(`^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*\S)\s*$`)
)

// FocusOutcome is one item of a week's focus as the following review scored it.
type FocusOutcome struct {
	Text string `json:"text"`
	// Kept is a ticked box. An unticked one is "not ticked": missed, or never
	// scored — a two-state checklist can't tell those apart.
	Kept bool `json:"kept"`
}

// ParseFocusOutcomes reads the checklist under "Last week's focus" in a weekly
// review — the generated note writes last week's focus there as `- [ ]` lines
// for the owner to tick. Only checkbox items count.
func ParseFocusOutcomes(body string) []FocusOutcome {
	var out []FocusOutcome
	in := false
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case lastFocusHeading.MatchString(trimmed):
			in = true
			continue
		case in && anyHeading.MatchString(trimmed):
			return out
		}
		if !in {
			continue
		}
		if m := checkItem.FindStringSubmatch(line); m != nil {
			out = append(out, FocusOutcome{Text: m[2], Kept: m[1] != " "})
		}
	}
	return out
}
