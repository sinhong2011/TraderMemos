package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// accountID creates an account for the token's user and returns its id.
func accountID(t *testing.T, s *api.Server, token string) string {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Main","base_currency":"USD","starting_balance":10000}`, token)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var acc struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc))
	return acc.ID
}

func TestRegisterThenLogin(t *testing.T) {
	s := testServer(t)
	require.NotEmpty(t, registerAndLogin(t, s, "a@b.com"))
}

func TestProtectedRouteRequiresAuth(t *testing.T) {
	s := testServer(t)
	rec := do(s, http.MethodGet, "/api/v1/accounts", "", "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAccountUserIsolation(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@x.com")
	tokB := registerAndLogin(t, s, "b@x.com")

	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"A-Main","base_currency":"USD","starting_balance":10000}`, tokA)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	// user B must not see user A's account
	rec = do(s, http.MethodGet, "/api/v1/accounts", "", tokB)
	require.Equal(t, http.StatusOK, rec.Code)
	var accs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &accs))
	require.Len(t, accs, 0)

	// user A sees exactly one
	rec = do(s, http.MethodGet, "/api/v1/accounts", "", tokA)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &accs))
	require.Len(t, accs, 1)
}

func TestManualExecutionsProduceClosedTrade(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "m@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, tok).Code)

	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	require.Equal(t, "closed", got[0]["status"])
	require.Equal(t, 200.0, got[0]["net_pnl"])

	rec = do(s, http.MethodGet, "/api/v1/analytics/summary?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var sum map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, 200.0, sum["net_pnl"])
	require.Equal(t, float64(1), sum["total_trades"])
}

func TestCSVImportEndToEnd(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "csv@x.com")
	acc := accountID(t, s, tok)

	csvBody := "Symbol,B/S,Qty,Fill Price,Trade Date,Commission\n" +
		"AAPL,BUY,100,10.00,2026-01-01T10:00:00Z,1.00\n" +
		"AAPL,SELL,100,12.00,2026-01-01T11:00:00Z,1.00\n" +
		"BADROW,BUY,notanumber,5,2026-01-01T10:00:00Z,0\n"

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartReq(t, "/api/v1/imports", tok, csvBody,
		map[string]string{"account_id": acc, "instrument_type": "stock"}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		ImportBatchID    string            `json:"import_batch_id"`
		SuggestedMapping map[string]string `json:"suggested_mapping"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.NotEmpty(t, preview.ImportBatchID)
	require.Equal(t, "Symbol", preview.SuggestedMapping["symbol"])

	mapping, _ := json.Marshal(preview.SuggestedMapping)
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartReq(t, "/api/v1/imports/"+preview.ImportBatchID+"/commit", tok, csvBody,
		map[string]string{"column_mapping": string(mapping), "instrument_type": "stock"}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var res struct {
		Inserted int `json:"inserted"`
		Skipped  int `json:"skipped"`
		Errors   []struct {
			Row int `json:"row"`
		} `json:"errors"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.Equal(t, 2, res.Inserted)
	require.Len(t, res.Errors, 1)

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	var got []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got, 1)
	require.Equal(t, 198.0, got[0]["net_pnl"])
}
