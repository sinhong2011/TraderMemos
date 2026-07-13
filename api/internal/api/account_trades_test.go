package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClearAccountTradesRemovesTradesAndExecutions(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "clear@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, tok).Code)

	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)

	rec = do(s, http.MethodDelete, "/api/v1/accounts/"+acc+"/trades", "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 0)

	rec = do(s, http.MethodGet, "/api/v1/executions?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var execs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &execs))
	require.Len(t, execs, 0)

	rec = do(s, http.MethodGet, "/api/v1/accounts/"+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestClearAccountTradesReturns404ForMissingAccount(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "clear404@x.com")
	_ = accountID(t, s, tok)

	rec := do(s, http.MethodDelete, "/api/v1/accounts/does-not-exist/trades", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestClearAccountTradesIsolatedPerUser(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "cleara@x.com")
	tokB := registerAndLogin(t, s, "clearb@x.com")
	accA := accountID(t, s, tokA)
	accB := accountID(t, s, tokB)

	buy := `{"account_id":"` + accA + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":10,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tokA).Code)

	rec := do(s, http.MethodDelete, "/api/v1/accounts/"+accB+"/trades", "", tokA)
	require.Equal(t, http.StatusNotFound, rec.Code)
}
