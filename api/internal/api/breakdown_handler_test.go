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

func TestBreakdownByTradeQuality(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "tq@x.com")
	acc := accountID(t, s, tok)

	mk := func(sym, side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, sym, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	// Two closed trades on different symbols so they get distinct trade IDs.
	mk("AAPL", "buy", 100, 10, "2026-01-01T10:00:00Z")
	mk("AAPL", "sell", 100, 12, "2026-01-01T11:00:00Z") // +200
	mk("MSFT", "buy", 50, 20, "2026-01-02T10:00:00Z")
	mk("MSFT", "sell", 50, 18, "2026-01-02T11:00:00Z") // -100

	// Fetch trade IDs, rate the AAPL trade 5 (A+); leave MSFT unrated.
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var trades []struct {
		ID     string `json:"id"`
		Symbol string `json:"symbol"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 2)
	for _, tr := range trades {
		if tr.Symbol == "AAPL" {
			require.Equal(t, http.StatusOK,
				do(s, http.MethodPatch, "/api/v1/trades/"+tr.ID, `{"trade_quality":5}`, tok).Code)
		}
	}

	rec = do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=trade_quality&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key     string `json:"key"`
		Summary struct {
			NetPnl float64 `json:"net_pnl"`
		} `json:"summary"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 2)

	got := map[string]float64{}
	for _, g := range out {
		got[g.Key] = g.Summary.NetPnl
	}
	require.Equal(t, 200.0, got["5"], "A+-rated AAPL trade")
	require.Equal(t, -100.0, got["unrated"], "unrated MSFT trade")
}

func TestBreakdownBySideDuration(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "sd@x.com")
	acc := accountID(t, s, tok)

	mk := func(sym, side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, sym, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	// AAPL: long scalp — buy 10:00, sell 10:05 (same ET day, 300s).
	mk("AAPL", "buy", 100, 10, "2026-01-02T15:00:00Z")
	mk("AAPL", "sell", 100, 11, "2026-01-02T15:05:00Z")
	// MSFT: long swing — buy day 1, sell day 3.
	mk("MSFT", "buy", 50, 20, "2026-01-02T15:00:00Z")
	mk("MSFT", "sell", 50, 22, "2026-01-05T15:00:00Z")

	// side=long & duration=scalp → only AAPL.
	rec := do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&side=long&duration=scalp&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 1)
	require.Equal(t, "AAPL", out[0].Key)

	// invalid side → 400
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&side=bogus", "", tok).Code)
	// invalid duration → 400
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&duration=bogus", "", tok).Code)
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
