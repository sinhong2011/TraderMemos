package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// backtestAccountID creates a backtest (paper) account and returns its id.
func backtestAccountID(t *testing.T, s *api.Server, token string) string {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Replay","account_type":"backtest","base_currency":"USD","starting_balance":10000}`, token)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID          string `json:"id"`
		AccountType string `json:"account_type"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))
	require.Equal(t, api.AccountTypeBacktest, acc.AccountType)
	return acc.ID
}

func closeRoundTrip(t *testing.T, s *api.Server, token, accID, symbol string) {
	t.Helper()
	buy := `{"account_id":"` + accID + `","symbol":"` + symbol + `","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-05T10:00:00Z"}`
	sell := `{"account_id":"` + accID + `","symbol":"` + symbol + `","instrument_type":"stock","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-05T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, token).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, token).Code)
}

func TestBacktestAccountExcludedFromDefaultAggregates(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "backtest@x.com")
	live := accountID(t, s, tok)
	paper := backtestAccountID(t, s, tok)

	closeRoundTrip(t, s, tok, live, "AAPL")
	closeRoundTrip(t, s, tok, paper, "MSFT")

	// All-account summary sees only the live trade.
	rec := do(s, http.MethodGet, "/api/v1/analytics/summary", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var sum struct {
		TotalTrades int `json:"total_trades"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, 1, sum.TotalTrades)

	// Selecting the backtest account explicitly opts in.
	rec = do(s, http.MethodGet, "/api/v1/analytics/summary?account_id="+paper, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, 1, sum.TotalTrades)

	// Trade log: unscoped hides the backtest trade, scoped shows it.
	rec = do(s, http.MethodGet, "/api/v1/trades", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []struct {
		Symbol string `json:"symbol"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)
	require.Equal(t, "AAPL", trades[0].Symbol)

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+paper, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)
	require.Equal(t, "MSFT", trades[0].Symbol)
}

func TestBacktestCashExcludedFromDefaultLists(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "backtestcash@x.com")
	_ = accountID(t, s, tok)         // live account, 10k opening deposit
	_ = backtestAccountID(t, s, tok) // paper account, 10k opening deposit

	// Unscoped cash list shows only the live opening deposit.
	rec := do(s, http.MethodGet, "/api/v1/cash-transactions", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var cash []struct {
		Amount float64 `json:"amount"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cash))
	require.Len(t, cash, 1)

	// Equity curve is likewise unpolluted: last point equals one deposit.
	rec = do(s, http.MethodGet, "/api/v1/analytics/equity-curve", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var curve struct {
		Points []struct {
			Equity float64 `json:"equity"`
		} `json:"points"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &curve))
	require.NotEmpty(t, curve.Points)
	require.InDelta(t, 10000, curve.Points[len(curve.Points)-1].Equity, 0.01)
}

func TestExportKeepsBacktestTrades(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "backtestexport@x.com")
	live := accountID(t, s, tok)
	paper := backtestAccountID(t, s, tok)

	closeRoundTrip(t, s, tok, live, "AAPL")
	closeRoundTrip(t, s, tok, paper, "MSFT")

	_ = live

	// Exports are account-scoped; exporting the backtest account itself must
	// return its trades (the aggregate exclusion never applies to backups).
	rec := do(s, http.MethodGet, "/api/v1/exports?format=json&account_id="+paper, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var export struct {
		Trades []struct {
			Symbol string `json:"symbol"`
		} `json:"trades"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &export))
	require.Len(t, export.Trades, 1)
	require.Equal(t, "MSFT", export.Trades[0].Symbol)
}
