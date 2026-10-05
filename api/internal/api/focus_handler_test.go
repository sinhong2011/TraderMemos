package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/alerts"
)

type focusResp struct {
	WeekStart string   `json:"week_start"`
	Items     []string `json:"items"`
	NoteID    string   `json:"note_id"`
	NoteTitle string   `json:"note_title"`
}

func TestCurrentFocus(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "focus@x.com")

	ny, err := time.LoadLocation(alerts.DefaultMarketTimezone)
	require.NoError(t, err)
	start, _ := alerts.ReviewWeek(time.Now(), ny)
	lastSaturday := start.AddDate(0, 0, -2).Format("2006-01-02")

	get := func() focusResp {
		rec := do(s, http.MethodGet, "/api/v1/focus/current", "", tok)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out focusResp
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		return out
	}

	// No review yet: an empty focus for this week.
	got := get()
	require.Equal(t, alerts.WeekKey(start), got.WeekStart)
	require.Empty(t, got.Items)
	require.Empty(t, got.NoteID)

	body := "## What didn't\\n\\n- Chased\\n\\n## Focus for next week\\n\\n- Wait for the retest\\n- Stop after two losses\\n"
	rec := do(s, http.MethodPost, "/api/v1/notes", fmt.Sprintf(
		`{"type":"weekly_review","occurred_at":"%s","title":"Week review","body":"%s"}`, lastSaturday, body), tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var note map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &note))

	got = get()
	require.Equal(t, []string{"Wait for the retest", "Stop after two losses"}, got.Items)
	require.Equal(t, note["id"], got.NoteID)
	require.Equal(t, "Week review", got.NoteTitle)

	// Editing the review changes the focus.
	edited := "## Focus for next week\\n\\n- Size down on Mondays\\n"
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/notes/"+note["id"].(string),
		fmt.Sprintf(`{"type":"weekly_review","occurred_at":"%s","title":"Week review","body":"%s"}`,
			lastSaturday, edited), tok).Code)
	require.Equal(t, []string{"Size down on Mondays"}, get().Items)

	// A plain note with the same heading is not a review.
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/notes", fmt.Sprintf(
		`{"occurred_at":"%s","title":"Scratch","body":"## Focus for next week\\n- not this"}`,
		start.AddDate(0, 0, -1).Format("2006-01-02")), tok).Code)
	require.Equal(t, []string{"Size down on Mondays"}, get().Items)
}
