package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEdgeScoreEndpoint(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "edge@example.com")

	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Main","base_currency":"USD","starting_balance":10000}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))

	get := func() map[string]any {
		rec := do(s, http.MethodGet, "/api/v1/analytics/edge-score?account_id="+acc.ID, "", tok)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		return out
	}
	trade := func(day int, exit float64) {
		fill := func(side string, price float64, hour int) string {
			return fmt.Sprintf(`{"account_id":%q,"symbol":"AAPL","instrument_type":"stock","side":%q,`+
				`"quantity":10,"price":%v,"executed_at":"2026-03-%02dT%02d:00:00Z"}`, acc.ID, side, price, day, hour)
		}
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", fill("buy", 100, 14), tok).Code)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", fill("sell", exit, 15), tok).Code)
	}

	for i, exit := range []float64{130, 90, 120, 90} {
		trade(i+2, exit)
	}
	out := get()
	require.Nil(t, out["score"], "4 trades is below the minimum")
	require.EqualValues(t, 4, out["closed_trades"])

	trade(6, 110)
	out = get()
	require.NotNil(t, out["score"])
	require.EqualValues(t, 5, out["closed_trades"])
	inputs := out["inputs"].(map[string]any)
	require.NotNil(t, inputs["max_drawdown_pct"], "the opening deposit is the capital base even though it post-dates the trades")
}
