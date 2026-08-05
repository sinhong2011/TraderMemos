package api_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// The account's starting_balance is seeded into the cash ledger as the
// "Opening balance" deposit, so the equity curve must build on the ledger
// alone — adding starting_balance again would count that money twice.
func TestEquityCurveDoesNotDoubleCountOpeningBalance(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "equity@example.com")

	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Main","base_currency":"USD","starting_balance":10000}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))

	later := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	rec = do(s, http.MethodPost, "/api/v1/cash-transactions",
		`{"account_id":"`+acc.ID+`","type":"deposit","amount":1589.47,`+
			`"currency":"USD","occurred_at":"`+later+`"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/analytics/equity-curve", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var curve struct {
		Points []struct {
			Equity float64 `json:"equity"`
		} `json:"points"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &curve))
	require.Len(t, curve.Points, 2)
	require.InDelta(t, 10000, curve.Points[0].Equity, 0.001)
	require.InDelta(t, 11589.47, curve.Points[1].Equity, 0.001)
}

// An account funded purely through the ledger (no starting_balance) tracks its
// deposits exactly.
func TestEquityCurveLedgerOnlyAccount(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "ledger@example.com")

	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Zero","base_currency":"USD","starting_balance":0}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))

	at := time.Now().UTC().Format(time.RFC3339)
	rec = do(s, http.MethodPost, "/api/v1/cash-transactions",
		`{"account_id":"`+acc.ID+`","type":"deposit","amount":1589.47,`+
			`"currency":"USD","occurred_at":"`+at+`"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/analytics/equity-curve", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var curve struct {
		Points []struct {
			Equity float64 `json:"equity"`
		} `json:"points"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &curve))
	require.Len(t, curve.Points, 1)
	require.InDelta(t, 1589.47, curve.Points[0].Equity, 0.001)
}
