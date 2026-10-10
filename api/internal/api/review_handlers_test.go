package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// reviewTrade opens and closes 10 shares of sym daysAgo days back, returning
// the trade id.
func reviewTrade(t *testing.T, s *api.Server, tok, acc, sym string, daysAgo int) string {
	t.Helper()
	at := time.Now().UTC().AddDate(0, 0, -daysAgo).Truncate(time.Hour)
	buy := fmt.Sprintf(`{"account_id":"%s","symbol":"%s","instrument_type":"stock","side":"buy","quantity":10,"price":100,"executed_at":"%s"}`,
		acc, sym, at.Add(-time.Hour).Format(time.RFC3339))
	sell := fmt.Sprintf(`{"account_id":"%s","symbol":"%s","instrument_type":"stock","side":"sell","quantity":10,"price":101,"executed_at":"%s"}`,
		acc, sym, at.Format(time.RFC3339))
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	return created["trade_id"]
}

type inboxResp struct {
	Items []struct {
		ID     string `json:"id"`
		Symbol string `json:"symbol"`
	} `json:"items"`
	WindowDays int `json:"window_days"`
	Backlog    int `json:"backlog"`
}

func getInbox(t *testing.T, s *api.Server, tok string) inboxResp {
	t.Helper()
	rec := do(s, http.MethodGet, "/api/v1/reviews/inbox", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out inboxResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func TestReviewInbox(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "inbox@x.com")
	acc := accountID(t, s, tok)

	newer := reviewTrade(t, s, tok, acc, "NEW", 1)
	older := reviewTrade(t, s, tok, acc, "MID", 3)
	graded := reviewTrade(t, s, tok, acc, "DONE", 2)
	reviewTrade(t, s, tok, acc, "OLD", 30)
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+graded, `{"trade_quality":4}`, tok).Code)
	// A note without a grade still leaves the trade in the inbox.
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+older, `{"notes":"looked fine"}`, tok).Code)

	got := getInbox(t, s, tok)
	require.Equal(t, 14, got.WindowDays)
	require.Len(t, got.Items, 2)
	require.Equal(t, newer, got.Items[0].ID) // newest first
	require.Equal(t, older, got.Items[1].ID)
	require.Equal(t, 1, got.Backlog)

	// Dismissing the backlog empties it without touching the queue.
	rec := do(s, http.MethodPost, "/api/v1/reviews/dismiss-backlog", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	got = getInbox(t, s, tok)
	require.Equal(t, 0, got.Backlog)
	require.Len(t, got.Items, 2)

	// The cutoff lives with the other preferences and survives a client patch.
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/me/preferences", `{"clock24h":true}`, tok).Code)
	require.Equal(t, 0, getInbox(t, s, tok).Backlog)

	// Grading clears a trade; clearing the grade puts it back.
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+newer, `{"trade_quality":5}`, tok).Code)
	got = getInbox(t, s, tok)
	require.Len(t, got.Items, 1)
	require.Equal(t, older, got.Items[0].ID)
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+newer, `{"trade_quality":0}`, tok).Code)
	require.Len(t, getInbox(t, s, tok).Items, 2)
}

func TestReviewInboxRejectsBadWindow(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "inbox-window@x.com")
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodGet, "/api/v1/reviews/inbox?window_days=0", "", tok).Code)
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodGet, "/api/v1/reviews/inbox?window_days=500", "", tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodGet, "/api/v1/reviews/inbox?window_days=7", "", tok).Code)
}
