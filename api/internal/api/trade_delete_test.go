package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeleteTrade(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "delete-trade@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"QQQ","instrument_type":"stock","side":"buy","quantity":10,"price":100,"fees":1,"executed_at":"2026-01-02T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"QQQ","instrument_type":"stock","side":"sell","quantity":10,"price":110,"fees":1,"executed_at":"2026-01-02T11:00:00Z"}`
	buyRec := do(s, http.MethodPost, "/api/v1/executions", buy, tok)
	require.Equal(t, http.StatusCreated, buyRec.Code, buyRec.Body.String())
	sellRec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, sellRec.Code, sellRec.Body.String())

	var created struct {
		TradeID string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal(buyRec.Body.Bytes(), &created))
	require.NotEmpty(t, created.TradeID)

	rec := do(s, http.MethodDelete, "/api/v1/trades/"+created.TradeID, "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades/"+created.TradeID, "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 0)

	rec = do(s, http.MethodDelete, "/api/v1/trades/"+created.TradeID, "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}
