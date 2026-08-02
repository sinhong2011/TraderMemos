package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBehaviorEndpoint(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "behavior@x.com")
	acc := accountID(t, s, tok)

	// A losing AAPL round-trip, then a re-entry 5 minutes after the losing
	// close — inside the quick-reentry window.
	execs := []string{
		`{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-05T10:00:00Z"}`,
		`{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":9,"executed_at":"2026-01-05T10:30:00Z"}`,
		`{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":9,"executed_at":"2026-01-05T10:35:00Z"}`,
		`{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":10,"executed_at":"2026-01-05T10:50:00Z"}`,
	}
	for _, e := range execs {
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", e, tok).Code)
	}

	rec := do(s, http.MethodGet, "/api/v1/analytics/behavior?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var rep struct {
		Trades  int `json:"trades"`
		Revenge struct {
			InsufficientData bool `json:"insufficient_data"`
			Events           []struct {
				TradeID string `json:"trade_id"`
				Reason  string `json:"reason"`
				Date    string `json:"date"`
			} `json:"events"`
			Flagged struct {
				Trades int     `json:"trades"`
				NetPnl float64 `json:"net_pnl"`
			} `json:"flagged"`
		} `json:"revenge"`
		LossAversion struct {
			Excluded int `json:"excluded"`
		} `json:"loss_aversion"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rep))

	require.Equal(t, 2, rep.Trades)
	require.True(t, rep.Revenge.InsufficientData) // 2 trades < MinTrades
	require.Len(t, rep.Revenge.Events, 1)
	require.Equal(t, "quick_reentry", rep.Revenge.Events[0].Reason)
	require.Equal(t, "2026-01-05", rep.Revenge.Events[0].Date)
	require.Equal(t, 1, rep.Revenge.Flagged.Trades)
	require.Equal(t, 100.0, rep.Revenge.Flagged.NetPnl)
	// The loser has no recorded MFE.
	require.Equal(t, 1, rep.LossAversion.Excluded)
}

func TestBehaviorEndpointRequiresAuth(t *testing.T) {
	s := testServer(t)
	rec := do(s, http.MethodGet, "/api/v1/analytics/behavior", "", "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
