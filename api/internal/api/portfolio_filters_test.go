package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/tradermemos/api/internal/api"
)

func accountWithCurrency(t *testing.T, s *api.Server, token, name, currency string) string {
	t.Helper()
	body := fmt.Sprintf(`{"name":%q,"base_currency":%q,"starting_balance":10000}`, name, currency)
	rec := do(s, http.MethodPost, "/api/v1/accounts", body, token)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))
	return acc.ID
}

// seedClosedTrade books a round-trip AAPL trade worth +$200 net into the account.
func seedClosedTrade(t *testing.T, s *api.Server, token, accountID, symbol string, qty float64) {
	t.Helper()
	buy := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":"buy","quantity":%g,"price":10,"executed_at":"2026-01-05T10:00:00Z"}`, accountID, symbol, qty)
	sell := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":"sell","quantity":%g,"price":12,"executed_at":"2026-01-05T11:00:00Z"}`, accountID, symbol, qty)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, token).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, token).Code)
}

func summaryFor(t *testing.T, s *api.Server, token, query string) map[string]any {
	t.Helper()
	rec := do(s, http.MethodGet, "/api/v1/analytics/summary"+query, "", token)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func TestPortfolioFiltersAggregateSelectedAccounts(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "portfolio@x.com")
	accA := accountWithCurrency(t, s, tok, "Prop A", "USD")
	accB := accountWithCurrency(t, s, tok, "Prop B", "USD")
	accC := accountWithCurrency(t, s, tok, "Prop C", "USD")

	seedClosedTrade(t, s, tok, accA, "AAPL", 100) // +200
	seedClosedTrade(t, s, tok, accB, "MSFT", 50)  // +100
	seedClosedTrade(t, s, tok, accC, "NVDA", 10)  // +20

	// Comma-separated pair: A+B only, C excluded.
	sum := summaryFor(t, s, tok, "?account_id="+accA+","+accB)
	require.EqualValues(t, 2, sum["total_trades"])
	require.InDelta(t, 300, sum["net_pnl"].(float64), 0.01)

	// Repeated params behave the same.
	sum = summaryFor(t, s, tok, "?account_id="+accA+"&account_id="+accB)
	require.EqualValues(t, 2, sum["total_trades"])

	// Single account keeps its meaning.
	sum = summaryFor(t, s, tok, "?account_id="+accB)
	require.EqualValues(t, 1, sum["total_trades"])
	require.InDelta(t, 100, sum["net_pnl"].(float64), 0.01)

	// No filter still means all accounts.
	sum = summaryFor(t, s, tok, "")
	require.EqualValues(t, 3, sum["total_trades"])

	// The trade log honors the same multi-account scope.
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+accA+","+accB, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 2)
}

func TestPortfolioFiltersRejectMixedCurrencies(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "portfolio-fx@x.com")
	usd := accountWithCurrency(t, s, tok, "US", "USD")
	eur := accountWithCurrency(t, s, tok, "EU", "EUR")
	seedClosedTrade(t, s, tok, usd, "AAPL", 10)
	seedClosedTrade(t, s, tok, eur, "SAP", 10)

	for _, path := range []string{
		"/api/v1/analytics/summary",
		"/api/v1/analytics/daily",
		"/api/v1/analytics/equity-curve",
		"/api/v1/trades",
	} {
		rec := do(s, http.MethodGet, path+"?account_id="+usd+","+eur, "", tok)
		require.Equal(t, http.StatusBadRequest, rec.Code, "%s: %s", path, rec.Body.String())
		var e struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &e))
		require.Equal(t, "mixed_currencies", e.Error.Code, path)
	}

	// Each account alone still works.
	require.EqualValues(t, 1, summaryFor(t, s, tok, "?account_id="+usd)["total_trades"])
	require.EqualValues(t, 1, summaryFor(t, s, tok, "?account_id="+eur)["total_trades"])
}

func TestPortfolioCashListHonorsAccountSet(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "portfolio-cash@x.com")
	accA := accountWithCurrency(t, s, tok, "A", "USD")
	accB := accountWithCurrency(t, s, tok, "B", "USD")
	accC := accountWithCurrency(t, s, tok, "C", "USD")

	rec := do(s, http.MethodGet, "/api/v1/cash-transactions?account_id="+accA+","+accB, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var rows []struct {
		AccountID string `json:"account_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rows))
	// Each account carries its seeded opening deposit; C's must not appear.
	require.NotEmpty(t, rows)
	for _, r := range rows {
		require.Contains(t, []string{accA, accB}, r.AccountID)
		require.NotEqual(t, accC, r.AccountID)
	}
}
