package api_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type alertSettingsJSON struct {
	Enabled          bool `json:"enabled"`
	RuleUnreviewed   bool `json:"rule_unreviewed"`
	RuleWeeklyReview bool `json:"rule_weekly_review"`
}

func TestAlertSettingsWeeklyReviewToggle(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "weekly-toggle@example.com")

	// Unconfigured: defaults on.
	rec := do(s, http.MethodGet, "/api/v1/settings/alerts", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.True(t, decode[alertSettingsJSON](t, rec.Body.Bytes()).RuleWeeklyReview)

	// A first save that omits the field (an older client) keeps it on.
	rec = do(s, http.MethodPut, "/api/v1/settings/alerts", `{"enabled":true,"timezone":"UTC"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.True(t, decode[alertSettingsJSON](t, rec.Body.Bytes()).RuleWeeklyReview)

	// Off round-trips.
	rec = do(s, http.MethodPut, "/api/v1/settings/alerts", `{"enabled":true,"rule_weekly_review":false}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.False(t, decode[alertSettingsJSON](t, rec.Body.Bytes()).RuleWeeklyReview)
	rec = do(s, http.MethodGet, "/api/v1/settings/alerts", "", tok)
	require.False(t, decode[alertSettingsJSON](t, rec.Body.Bytes()).RuleWeeklyReview)

	// An older client saving some other toggle must not switch it back on.
	rec = do(s, http.MethodPut, "/api/v1/settings/alerts", `{"enabled":true,"rule_unreviewed":false}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got := decode[alertSettingsJSON](t, rec.Body.Bytes())
	require.False(t, got.RuleWeeklyReview)
	require.False(t, got.RuleUnreviewed)

	// And back on.
	rec = do(s, http.MethodPut, "/api/v1/settings/alerts", `{"enabled":true,"rule_weekly_review":true}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.True(t, decode[alertSettingsJSON](t, rec.Body.Bytes()).RuleWeeklyReview)
}

type noteJSON struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title"`
}

// A weekly review edited from a client keeps its type — clients send it back.
func TestWeeklyReviewNoteTypeRoundTrips(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "weekly-note@example.com")

	rec := do(s, http.MethodPost, "/api/v1/notes",
		`{"type":"weekly_review","occurred_at":"2026-10-03","body":"## What worked\n\nPatience"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	n := decode[noteJSON](t, rec.Body.Bytes())
	require.Equal(t, "weekly_review", n.Type)
	require.Equal(t, "Weekly review", n.Title)

	rec = do(s, http.MethodPatch, "/api/v1/notes/"+n.ID,
		`{"type":"weekly_review","occurred_at":"2026-10-03","title":"Week of Sep 28 – Oct 4","body":"edited"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "weekly_review", decode[noteJSON](t, rec.Body.Bytes()).Type)

	rec = do(s, http.MethodGet, "/api/v1/notes", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	list := decode[[]noteJSON](t, rec.Body.Bytes())
	require.Len(t, list, 1)
	require.Equal(t, "weekly_review", list[0].Type)

	rec = do(s, http.MethodPost, "/api/v1/notes", `{"type":"bogus","occurred_at":"2026-10-03","body":"x"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
