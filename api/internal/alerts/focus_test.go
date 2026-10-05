package alerts

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/store"
)

func TestParseFocus(t *testing.T) {
	body := `## Week in numbers

- Net P&L: +$420.00

## What didn't

- Chased the open twice

## Focus for next week

Some context line that is not a commitment.
- Wait for the first pullback
* [ ] No trades after two losses
1. Size down on Mondays
- A fourth item is one too many

## Notes
- not focus`
	require.Equal(t, []string{
		"Wait for the first pullback",
		"No trades after two losses",
		"Size down on Mondays",
	}, ParseFocus(body))
}

func TestParseFocusEdges(t *testing.T) {
	require.Empty(t, ParseFocus("## Focus for next week\n\n"))
	require.Empty(t, ParseFocus("no headings at all\n- a bullet"))
	require.Equal(t, []string{"Only one"}, ParseFocus("### focus for next week:\n  - Only one  \n# Done\n- x"))
	require.Equal(t, []string{"Ticked item"}, ParseFocus("## Focus for next week\n- [x] Ticked item"))
}

func TestWeeklyNoteBodyListsLastFocus(t *testing.T) {
	st := WeeklyStats{
		NetPnl:    []CurrencyAmount{{Currency: "USD"}},
		LastFocus: []string{"Wait for the pullback", "Stop after two losses"},
	}
	body := WeeklyNoteBody(st)
	require.Contains(t, body, "## Last week's focus\n\n- [ ] Wait for the pullback\n- [ ] Stop after two losses\n")
	require.Less(t, strings.Index(body, "## Last week's focus"), strings.Index(body, "## What worked"))
	// The new note's own focus section stays empty for this week's answer.
	require.Empty(t, ParseFocus(body))

	require.NotContains(t, WeeklyNoteBody(WeeklyStats{NetPnl: []CurrencyAmount{{Currency: "USD"}}}), "Last week's focus")
}

type fakeNotes struct {
	notes []store.JournalNote
	got   store.ListJournalNotesParams
}

func (f *fakeNotes) ListJournalNotes(_ context.Context, arg store.ListJournalNotesParams) ([]store.JournalNote, error) {
	f.got = arg
	return f.notes, nil
}

func TestPreviousFocus(t *testing.T) {
	week := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC) // Monday
	q := &fakeNotes{notes: []store.JournalNote{
		{ID: "daily", NoteType: "daily_log", OccurredAt: "2026-10-04", Body: "## Focus for next week\n- not a review"},
		{ID: "review", NoteType: NoteTypeWeeklyReview, OccurredAt: "2026-10-03", Body: "## Focus for next week\n- Wait for the retest"},
		{ID: "older", NoteType: NoteTypeWeeklyReview, OccurredAt: "2026-09-26", Body: "## Focus for next week\n- Old focus"},
	}}
	items, note, err := PreviousFocus(context.Background(), q, "u1", week)
	require.NoError(t, err)
	require.Equal(t, []string{"Wait for the retest"}, items)
	require.Equal(t, "review", note.ID)
	require.Equal(t, "2026-09-21", q.got.FromDate)
	require.Equal(t, "2026-10-04", q.got.ToDate)

	empty := &fakeNotes{}
	items, note, err = PreviousFocus(context.Background(), empty, "u1", week)
	require.NoError(t, err)
	require.Nil(t, items)
	require.Nil(t, note)
}
