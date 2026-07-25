package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRiskRulesRoundTrip(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "rules@x.com")

	rec := do(s, http.MethodGet, "/api/v1/settings/risk-rules", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var empty map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &empty))
	require.Nil(t, empty["max_risk_per_trade"])

	body := `{"max_risk_per_trade":100,"max_daily_loss":300,"max_open_risk":250,"default_account_risk_pct":1}`
	rec = do(s, http.MethodPut, "/api/v1/settings/risk-rules", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/settings/risk-rules", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, 100.0, got["max_risk_per_trade"])
	require.Equal(t, 300.0, got["max_daily_loss"])
	require.Equal(t, 1.0, got["default_account_risk_pct"])
}

func TestAnnualGoalRoundTrip(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "goal@x.com")

	rec := do(s, http.MethodGet, "/api/v1/settings/annual-goal?year=2026", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var empty map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &empty))
	require.Equal(t, float64(2026), empty["year"])
	require.Nil(t, empty["amount"])

	body := `{"year":2026,"amount":100000}`
	rec = do(s, http.MethodPut, "/api/v1/settings/annual-goal", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/settings/annual-goal?year=2026", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, float64(2026), got["year"])
	require.Equal(t, 100000.0, got["amount"])

	rec = do(s, http.MethodPut, "/api/v1/settings/annual-goal", `{"year":2026,"amount":0}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	rec = do(s, http.MethodDelete, "/api/v1/settings/annual-goal?year=2026", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Nil(t, got["amount"])
}

func TestRSummaryExcludesMissingRisk(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "rsum@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":10,"price":100,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":10,"price":110,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var created map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))

	// Without initial_risk → excluded
	rec = do(s, http.MethodGet, "/api/v1/analytics/r-summary?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var sum map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, float64(1), sum["excluded"])
	require.Equal(t, float64(0), sum["total_trades"])

	// Set risk → included as +2R on $100 risk with $100 pnl
	patch := `{"initial_risk":50}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+created["trade_id"], patch, tok).Code)

	rec = do(s, http.MethodGet, "/api/v1/analytics/r-summary?account_id="+acc, "", tok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, float64(0), sum["excluded"])
	require.Equal(t, float64(1), sum["total_trades"])
	require.Equal(t, 2.0, sum["avg_r"])
}
