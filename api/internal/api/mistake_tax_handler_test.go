package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// taxRoundTrip opens and closes 10 shares of its own symbol on Jan <day>,
// returning the trade id.
func taxRoundTrip(t *testing.T, s *api.Server, tok, acc string, day int, exit float64) string {
	t.Helper()
	sym := fmt.Sprintf("TX%02d", day)
	at := func(h int) string { return fmt.Sprintf("2026-01-%02dT%02d:00:00Z", day, h) }
	buy := fmt.Sprintf(`{"account_id":"%s","symbol":"%s","instrument_type":"stock","side":"buy","quantity":10,"price":100,"executed_at":"%s"}`, acc, sym, at(14))
	sell := fmt.Sprintf(`{"account_id":"%s","symbol":"%s","instrument_type":"stock","side":"sell","quantity":10,"price":%g,"executed_at":"%s"}`, acc, sym, exit, at(15))
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	return created["trade_id"]
}

func TestMistakeTax(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "tax@x.com")
	acc := accountID(t, s, tok)

	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/risk-rules",
		`{"max_risk_per_trade":100}`, tok).Code)
	rec := do(s, http.MethodPost, "/api/v1/tags", `{"name":"Chased","kind":"mistake"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var tag map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tag))

	chased := taxRoundTrip(t, s, tok, acc, 5, 90)     // -$100, tagged Chased
	oversized := taxRoundTrip(t, s, tok, acc, 6, 95)  // -$50, risk $200 > $100 rule
	unreviewed := taxRoundTrip(t, s, tok, acc, 7, 97) // -$30, clean and no note
	taxRoundTrip(t, s, tok, acc, 8, 120)              // +$200, clean winner
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+chased,
		`{"tag_ids":["`+tag["id"].(string)+`"],"initial_risk":50}`, tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPatch, "/api/v1/trades/"+oversized,
		`{"initial_risk":200}`, tok).Code)

	rec = do(s, http.MethodGet, "/api/v1/analytics/mistake-tax?account_id="+acc+
		"&from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got struct {
		PeriodNet     float64 `json:"period_net"`
		TotalCost     float64 `json:"total_cost"`
		TotalCostR    float64 `json:"total_cost_r"`
		FlaggedTrades int     `json:"flagged_trades"`
		NetWithout    float64 `json:"net_without"`
		Bucket        string  `json:"bucket"`
		Sources       []struct {
			Key      string   `json:"key"`
			Kind     string   `json:"kind"`
			Label    string   `json:"label"`
			Cost     float64  `json:"cost"`
			TradeIDs []string `json:"trade_ids"`
		} `json:"sources"`
		UnreviewedIDs []string `json:"unreviewed_ids"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, 20.0, got.PeriodNet) // -100 -50 -30 +200
	require.Equal(t, 2, got.FlaggedTrades)
	require.Equal(t, 150.0, got.TotalCost)
	require.Equal(t, 2.25, got.TotalCostR) // 100/50 + 50/200
	require.Equal(t, 170.0, got.NetWithout)
	require.Equal(t, "week", got.Bucket)
	require.Len(t, got.Sources, 2)
	require.Equal(t, "Chased", got.Sources[0].Label)
	require.Equal(t, "tag", got.Sources[0].Kind)
	require.Equal(t, []string{chased}, got.Sources[0].TradeIDs)
	require.Equal(t, "rule:over_max_risk", got.Sources[1].Key)
	require.Equal(t, "Over max risk per trade", got.Sources[1].Label)
	require.Equal(t, []string{unreviewed}, got.UnreviewedIDs)

	// The compliance payload itself is unchanged: no per-trade field leaks out.
	rec = do(s, http.MethodGet, "/api/v1/analytics/compliance?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), `"violations":`)
}
