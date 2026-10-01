package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Real Schwab.com → Reports → Transactions CSV shape: `$` on Price /
// Fees & Comm / Amount, mixed trade + cash rows, date-only Eastern dates.
// Quoted cells match what encoding/csv yields after unquoting.
const schwabTransactionsCSV = `Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
09/14/2026,Buy,ACME,ACME CORP,100,"$20.00","$0.00","-$2000.00"
09/14/2026,Sell,ACME,ACME CORP,100,"$23.145","$0.07","$2314.43"
09/15/2026,Qualified Dividend,ACME,ACME CORP Q2,,,,"$12.50"
09/15/2026,Credit Interest,,,,"","","$1.02"
09/16/2026,Buy,MSFT,MICROSOFT CORP,50,"$400.00","$0.65","-$20000.65"
`

func TestSchwabTransactionsImportEndToEnd(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "schwab@x.com")
	acc := accountID(t, s, tok)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "Transactions_20260914.csv",
		schwabTransactionsCSV, map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		DetectedBroker    string            `json:"detected_broker"`
		SuggestedSourceTZ string            `json:"suggested_source_tz"`
		SuggestedMapping  map[string]string `json:"suggested_mapping"`
		RowCount          int               `json:"row_count"`
		ImportBatchID     string            `json:"import_batch_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.Contains(t, preview.DetectedBroker, "Schwab")
	require.Equal(t, "America/New_York", preview.SuggestedSourceTZ)
	require.Equal(t, 5, preview.RowCount)
	require.Empty(t, preview.ImportBatchID)
	require.Equal(t, "Action", preview.SuggestedMapping["side"])
	require.Equal(t, "Price", preview.SuggestedMapping["price"])
	require.Equal(t, "Fees & Comm", preview.SuggestedMapping["fees"])
	// "Fees & Comm" contains the "comm" hint; the guessed commission
	// mapping must not also bind that column or the cost is counted twice.
	require.NotEqual(t, "Fees & Comm", preview.SuggestedMapping["commission"])

	mapping, err := json.Marshal(preview.SuggestedMapping)
	require.NoError(t, err)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "Transactions_20260914.csv",
		schwabTransactionsCSV, map[string]string{
			"account_id":     acc,
			"column_mapping": string(mapping),
		}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var res struct {
		Inserted int `json:"inserted"`
		Skipped  int `json:"skipped"`
		Errors   []struct {
			Row     int    `json:"row"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	// Three fills in; dividend / interest are not fills and are skipped.
	require.Equal(t, 3, res.Inserted, rec.Body.String())
	require.Empty(t, res.Errors, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 2)

	bySymbol := map[string]map[string]any{}
	for _, tr := range trades {
		sym, _ := tr["symbol"].(string)
		bySymbol[sym] = tr
	}

	acme := bySymbol["ACME"]
	require.NotNil(t, acme)
	require.Equal(t, "closed", acme["status"])
	require.Equal(t, "long", acme["direction"])
	require.Equal(t, 314.43, acme["net_pnl"])
	require.Equal(t, 0.07, acme["fees_total"])
	// Date-only Schwab rows are Eastern midnight, not UTC midnight.
	require.Equal(t, "2026-09-14T04:00:00Z", acme["opened_at"])
	require.Equal(t, "2026-09-14T04:00:00Z", acme["closed_at"])

	msft := bySymbol["MSFT"]
	require.NotNil(t, msft)
	require.Equal(t, "open", msft["status"])
	require.Equal(t, 50.0, msft["qty_remaining"])
	require.Equal(t, 0.65, msft["fees_total"])
	require.Equal(t, "2026-09-16T04:00:00Z", msft["opened_at"])

	rec = do(s, http.MethodGet, "/api/v1/executions?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var execs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &execs))
	require.Len(t, execs, 3)
	prices := map[string]float64{}
	fees := map[string]float64{}
	for _, ex := range execs {
		key := ex["symbol"].(string) + ":" + ex["side"].(string)
		prices[key] = ex["price"].(float64)
		fees[key] = ex["fees"].(float64)
	}
	require.Equal(t, 20.0, prices["ACME:buy"])
	require.Equal(t, 23.145, prices["ACME:sell"])
	require.Equal(t, 0.07, fees["ACME:sell"])
	require.Equal(t, 400.0, prices["MSFT:buy"])
	require.Equal(t, 0.65, fees["MSFT:buy"])

	// Re-import is idempotent: the three fills dedup, cash rows stay skipped.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "Transactions_20260914.csv",
		schwabTransactionsCSV, map[string]string{
			"account_id":     acc,
			"column_mapping": string(mapping),
		}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.Equal(t, 0, res.Inserted, rec.Body.String())
	require.Equal(t, 3, res.Skipped, rec.Body.String())
	require.Empty(t, res.Errors, rec.Body.String())
}
