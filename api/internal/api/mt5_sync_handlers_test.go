package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type mt5SyncOut struct {
	Inserted      int    `json:"inserted"`
	Skipped       int    `json:"skipped"`
	ImportBatchID string `json:"import_batch_id"`
	Errors        []struct {
		Message string `json:"message"`
	} `json:"errors"`
	Warnings []string `json:"warnings"`
}

// The EURUSD round-trip from mt5StatementHTML, as the EA reports it.
const mt5EADeals = `[
	{"deal":"400101","time":"2024.01.15 10:30:00","type":"buy","symbol":"EURUSD","volume":0.5,"price":1.09312,"commission":-1.75,"swap":0,"fee":0},
	{"deal":"400102","time":"2024.01.15 14:45:30","type":"sell","symbol":"EURUSD","volume":0.5,"price":1.09501,"commission":-1.75,"swap":-1.2,"fee":0}
]`

func mt5Sync(t *testing.T, s *api.Server, token, body string) mt5SyncOut {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/sync/mt5", body, token)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out mt5SyncOut
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func importBatchCount(t *testing.T, s *api.Server, token string) int {
	t.Helper()
	rec := do(s, http.MethodGet, "/api/v1/imports", "", token)
	require.Equal(t, http.StatusOK, rec.Code)
	var batches []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &batches))
	return len(batches)
}

func TestMT5SyncMatchesStatementImport(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "mt5-ea@x.com")
	acc := accountID(t, s, tok)
	_, pat := mintPAT(t, s, tok, "mt5 ea")

	body := `{"account_id":"` + acc + `","login":"5012345","server":"Broker-Live","deals":` + mt5EADeals + `}`
	out := mt5Sync(t, s, pat, body)
	require.Equal(t, 2, out.Inserted)
	require.NotEmpty(t, out.ImportBatchID)
	require.Empty(t, out.Errors)

	// Same EET → UTC reading as the statement path.
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc+"&status=closed", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)
	require.Equal(t, "2024-01-15T08:30:00Z", trades[0]["opened_at"])

	// The batch is labelled and reversible like any import.
	rec = do(s, http.MethodGet, "/api/v1/imports", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var batches []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &batches))
	require.Len(t, batches, 1)
	require.Equal(t, "mt5-ea", batches[0]["source"])
	require.Equal(t, "MT5 5012345 @ Broker-Live", batches[0]["filename"])
	require.Equal(t, "committed", batches[0]["status"])

	// The statement export of the same deals dedups onto the EA's fills.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "report.html", mt5StatementHTML,
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var res struct {
		Inserted int `json:"inserted"`
		Skipped  int `json:"skipped"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.Equal(t, 0, res.Inserted)
	require.Equal(t, 2, res.Skipped)
}

func TestMT5SyncResendLeavesNoEmptyBatch(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "mt5-resend@x.com")
	acc := accountID(t, s, tok)
	body := `{"account_id":"` + acc + `","deals":` + mt5EADeals + `}`

	require.Equal(t, 2, mt5Sync(t, s, tok, body).Inserted)
	again := mt5Sync(t, s, tok, body)
	require.Equal(t, 0, again.Inserted)
	require.Equal(t, 2, again.Skipped)
	require.Empty(t, again.ImportBatchID)
	require.Equal(t, 1, importBatchCount(t, s, tok), "an all-duplicate sync is rolled back")
}

func TestMT5SyncKeepsIdenticalSplitFills(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "mt5-split@x.com")
	acc := accountID(t, s, tok)
	deal := func(id string) string {
		return `{"deal":"` + id + `","time":"2024.03.01 09:00:00","type":"buy","symbol":"XAUUSD","volume":0.1,"price":2050.5}`
	}
	body := `{"account_id":"` + acc + `","deals":[` + deal("1") + `,` + deal("2") + `]}`

	require.Equal(t, 2, mt5Sync(t, s, tok, body).Inserted, "one order split into identical deals is two fills")
	require.Equal(t, 2, mt5Sync(t, s, tok, body).Skipped)
}

func TestMT5SyncSkipsBadDealsAndWarnsOnOffset(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "mt5-warn@x.com")
	acc := accountID(t, s, tok)
	// Europe/Athens is never UTC+5 — the broker clock disagrees with the zone.
	body := `{"account_id":"` + acc + `","server_utc_offset":18000,"deals":[
		{"deal":"9","time":"2024.01.15 10:30:00","type":"balance","symbol":"","volume":0,"price":0},
		{"deal":"10","time":"2024.01.15 10:30:00","type":"buy","symbol":"EURUSD","volume":0.1,"price":1.1}
	]}`
	out := mt5Sync(t, s, tok, body)
	require.Equal(t, 1, out.Inserted)
	require.Len(t, out.Errors, 1)
	require.Len(t, out.Warnings, 1)
	require.True(t, strings.Contains(out.Warnings[0], "UTC+5"), out.Warnings[0])
}

func TestMT5SyncValidation(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "mt5-bad@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPost, "/api/v1/sync/mt5", `{"deals":[]}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/sync/mt5", `{"account_id":"`+acc+`","source_tz":"Mars/Base","deals":[]}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/sync/mt5", `{"account_id":"nope","deals":[]}`, tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/sync/mt5", `{"account_id":"`+acc+`","deals":[]}`, "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
