package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// roundTrip opens and closes one AAPL long of 10 shares, returning its trade id.
func roundTrip(t *testing.T, s *api.Server, tok, acc string, day int, exit float64) string {
	t.Helper()
	at := func(h int) string { return fmt.Sprintf("2026-01-%02dT%02d:00:00Z", day, h) }
	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":10,"price":100,"executed_at":"` + at(14) + `"}`
	sell := fmt.Sprintf(`{"account_id":"%s","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":10,"price":%g,"executed_at":"%s"}`, acc, exit, at(15))
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	return created["trade_id"]
}

func TestSetupScorecard(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "scorecard@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var setup map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))
	setupID := setup["id"].(string)

	rec = do(s, http.MethodPost, "/api/v1/tags", `{"name":"Chased","kind":"mistake"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var tag map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tag))
	tagID := tag["id"].(string)

	// ORB: +$100 (+2R) clean, -$50 (-1R) tagged Chased. One trade has no setup.
	win := roundTrip(t, s, tok, acc, 5, 110)
	loss := roundTrip(t, s, tok, acc, 6, 95)
	roundTrip(t, s, tok, acc, 7, 102)
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+win,
		`{"setup_id":"`+setupID+`","initial_risk":50}`, tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+loss,
		`{"setup_id":"`+setupID+`","initial_risk":50,"tag_ids":["`+tagID+`"]}`, tok).Code)

	rec = do(s, http.MethodGet, "/api/v1/analytics/setup-scorecard?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got struct {
		Setups []struct {
			SetupID     string   `json:"setup_id"`
			Name        string   `json:"name"`
			Trades      int      `json:"trades"`
			Basis       string   `json:"basis"`
			ExpectancyR *float64 `json:"expectancy_r"`
			CleanTrades int      `json:"clean_trades"`
			CleanMean   *float64 `json:"clean_mean"`
			Verdict     string   `json:"verdict"`
		} `json:"setups"`
		None *struct {
			Trades int    `json:"trades"`
			Basis  string `json:"basis"`
		} `json:"none"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got.Setups, 1)
	orb := got.Setups[0]
	require.Equal(t, setupID, orb.SetupID)
	require.Equal(t, "ORB", orb.Name)
	require.Equal(t, 2, orb.Trades)
	require.Equal(t, "r", orb.Basis)
	require.Equal(t, 0.5, *orb.ExpectancyR) // (2 + -1) / 2
	require.Equal(t, 1, orb.CleanTrades)
	require.Equal(t, 2.0, *orb.CleanMean)
	require.Equal(t, "unproven", orb.Verdict)

	require.NotNil(t, got.None)
	require.Equal(t, 1, got.None.Trades)
	require.Equal(t, "currency", got.None.Basis)
}
