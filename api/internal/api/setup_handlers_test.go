package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetupCRUDAndIsolation(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@s.com")
	tokB := registerAndLogin(t, s, "b@s.com")

	body := `{"name":"Breakout","description":"ORB","thesis":"Hold VWAP","symbol":"AAPL","direction":"long","target_price":110,"stop_price":95,"checklist":["Above VWAP","Volume spike"]}`
	rec := do(s, http.MethodPost, "/api/v1/setups", body, tokA)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Equal(t, "Breakout", created["name"])
	require.Equal(t, "Hold VWAP", created["thesis"])
	require.Equal(t, "AAPL", created["symbol"])
	require.Equal(t, "long", created["direction"])
	require.Equal(t, 110.0, created["target_price"])
	require.Equal(t, []any{"Above VWAP", "Volume spike"}, created["checklist"])
	id := created["id"].(string)

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokB)
	var setups []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 0)

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokA)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 1)

	patch := `{"name":"Breakout","thesis":"Updated","symbol":"MSFT","direction":"short","checklist":["Level held"]}`
	rec = do(s, http.MethodPatch, "/api/v1/setups/"+id, patch, tokA)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Equal(t, "Updated", created["thesis"])
	require.Equal(t, "MSFT", created["symbol"])
	require.Equal(t, "short", created["direction"])

	rec = do(s, http.MethodGet, "/api/v1/setups/"+id, "", tokA)
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestJournalEmotionFields(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "emo@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":10,"price":100,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":10,"price":110,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var created map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))

	patch := `{"notes":"clean","emotional_state":"Focused","confidence":4,"trade_quality":5}`
	rec = do(s, http.MethodPatch, "/api/v1/trades/"+created["trade_id"], patch, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var detail map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.Equal(t, "clean", detail["notes"])
	require.Equal(t, "Focused", detail["emotional_state"])
	require.Equal(t, float64(4), detail["confidence"])
	require.Equal(t, float64(5), detail["trade_quality"])
}
