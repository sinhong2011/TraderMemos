package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBreakdownBySymbol(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "bd@x.com")
	acc := accountID(t, s, tok)

	mk := func(sym, side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, sym, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	mk("AAPL", "buy", 100, 10, "2026-01-01T10:00:00Z")
	mk("AAPL", "sell", 100, 12, "2026-01-01T11:00:00Z") // +200
	mk("MSFT", "buy", 50, 20, "2026-01-02T10:00:00Z")
	mk("MSFT", "sell", 50, 18, "2026-01-02T11:00:00Z") // -100

	rec := do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key     string `json:"key"`
		Summary struct {
			NetPnl float64 `json:"net_pnl"`
		} `json:"summary"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 2)
	require.Equal(t, "AAPL", out[0].Key) // +200 sorts first
	require.Equal(t, 200.0, out[0].Summary.NetPnl)
	require.Equal(t, "MSFT", out[1].Key)
	require.Equal(t, -100.0, out[1].Summary.NetPnl)

	// invalid dimension -> 400
	rec = do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=bogus", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestBreakdownBySession(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "sess@x.com")
	acc := accountID(t, s, tok)

	// Open at 14:30 UTC = 09:30 ET → RTH
	mk := func(side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":"AAPL","instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	mk("buy", 10, 100, "2026-01-02T14:30:00Z")
	mk("sell", 10, 110, "2026-01-02T15:00:00Z")

	rec := do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=session&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotEmpty(t, out)
	require.Equal(t, "RTH", out[0].Key)
}

func TestNotesCRUD(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "note@x.com")

	rec := do(s, http.MethodPost, "/api/v1/notes", `{"occurred_at":"2026-07-10","title":"AM","body":"gap up"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var note map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &note))
	id := note["id"].(string)

	rec = do(s, http.MethodGet, "/api/v1/notes", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)

	rec = do(s, http.MethodPut, "/api/v1/settings/checklist-template", `{"items":["Check VIX","No revenge"]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = do(s, http.MethodGet, "/api/v1/settings/checklist-template", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var cl map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cl))
	require.Equal(t, []any{"Check VIX", "No revenge"}, cl["items"])

	require.Equal(t, http.StatusNoContent, do(s, http.MethodDelete, "/api/v1/notes/"+id, "", tok).Code)
}
