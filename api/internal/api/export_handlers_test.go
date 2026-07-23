package api_test

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExportUnifiedCSVAndJSON(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export@x.com")
	acc := accountID(t, s, tok)
	id := closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var setup map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))
	setupID := setup["id"].(string)

	rec = do(s, http.MethodPatch, "/api/v1/trades/"+id,
		`{"notes":"export me","setup_id":"`+setupID+`","initial_risk":100}`, tok)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=csv", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Contains(t, rec.Header().Get("Content-Type"), "text/csv")
	require.Contains(t, rec.Header().Get("Content-Disposition"), "tradermemos-export")
	records, err := csv.NewReader(strings.NewReader(rec.Body.String())).ReadAll()
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(records), 2)
	require.Equal(t, "AAPL", records[1][1])
	require.Equal(t, "ORB", records[1][17])
	require.Contains(t, records[0], "Call/Put")

	rec = do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=json", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	require.Equal(t, float64(1), payload["format_version"])
	require.Equal(t, float64(1), payload["trade_count"])
	trades := payload["trades"].([]any)
	require.Len(t, trades, 1)
	trade := trades[0].(map[string]any)
	require.Equal(t, "export me", trade["notes"])
	setups := payload["setups"].([]any)
	require.GreaterOrEqual(t, len(setups), 1)
	names := make([]string, 0, len(setups))
	for _, raw := range setups {
		names = append(names, raw.(map[string]any)["name"].(string))
	}
	require.Contains(t, names, "ORB")
}

func TestExportZipIncludesJSON(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-zip@x.com")
	acc := accountID(t, s, tok)
	_ = closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=zip", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "application/zip", rec.Header().Get("Content-Type"))
	require.Contains(t, rec.Header().Get("Content-Disposition"), ".zip")
	require.Greater(t, rec.Body.Len(), 100)
}

func TestExportJSONIncludesBrokerAndCash(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-cash@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPut, "/api/v1/accounts/"+acc,
		`{"name":"Testing","broker":"FUTU"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodPost, "/api/v1/cash-transactions",
		`{"account_id":"`+acc+`","type":"deposit","amount":500,"currency":"USD","occurred_at":"2026-01-02T00:00:00Z","note":"top up"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	rec = do(s, http.MethodPost, "/api/v1/cash-transactions",
		`{"account_id":"`+acc+`","type":"withdrawal","amount":100,"currency":"USD","occurred_at":"2026-01-03T00:00:00Z","note":"out"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	_ = closedTradeID(t, s, tok, acc)

	rec = do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=json", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	account := payload["account"].(map[string]any)
	require.Equal(t, "Testing", account["name"])
	require.Equal(t, "FUTU", account["broker"])
	cash := payload["cash_transactions"].([]any)
	require.Len(t, cash, 3) // opening deposit + deposit + withdrawal
}

func TestJSONImportRestoresBrokerAndCash(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "json-cash@x.com")
	acc := accountID(t, s, tok)

	jsonBody := `{
		"account": {
			"name": "Testing",
			"broker": "FUTU",
			"account_type": "cash",
			"base_currency": "USD",
			"starting_balance": 12500
		},
		"cash_transactions": [
			{"type":"deposit","amount":500,"currency":"USD","occurred_at":"2026-01-02T00:00:00Z","note":"top up"},
			{"type":"withdrawal","amount":100,"currency":"USD","occurred_at":"2026-01-03T00:00:00Z","note":"out"}
		],
		"trades": [{
			"symbol": "AAPL",
			"instrument_type": "stock",
			"direction": "long",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "2026-01-01T11:00:00Z",
			"qty_opened": 100,
			"avg_entry_price": 10,
			"avg_exit_price": 12,
			"net_pnl": 200
		}]
	}`

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "backup.json", jsonBody,
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		ImportBatchID string `json:"import_batch_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.Empty(t, preview.ImportBatchID)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "backup.json", jsonBody,
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var res struct {
		CashInserted int `json:"cash_inserted"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.Equal(t, 2, res.CashInserted)

	rec = do(s, http.MethodGet, "/api/v1/accounts/"+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var account map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &account))
	require.Equal(t, "Testing", account["name"])
	require.Equal(t, "FUTU", account["broker"])
	require.Equal(t, 12500.0, account["starting_balance"])

	rec = do(s, http.MethodGet, "/api/v1/cash-transactions?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var cash []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cash))
	require.Len(t, cash, 3) // opening deposit from create + imported deposit/withdrawal
}

func TestJSONImportRestoresSetupsCatalog(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "json-setups@x.com")
	acc := accountID(t, s, tok)

	jsonBody := `{
		"setups": [{
			"name": "VWAP Fade",
			"description": "Fade extremes",
			"thesis": "Mean reversion at VWAP",
			"symbol": "SPY",
			"direction": "short",
			"target_price": 500,
			"stop_price": 505,
			"checklist": ["At VWAP", "No news"]
		}],
		"trades": [{
			"symbol": "SPY",
			"instrument_type": "stock",
			"direction": "short",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "2026-01-01T11:00:00Z",
			"qty_opened": 10,
			"avg_entry_price": 502,
			"avg_exit_price": 500,
			"net_pnl": 20,
			"setup": {"name": "VWAP Fade"}
		}]
	}`

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "backup.json", jsonBody,
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		ImportBatchID string `json:"import_batch_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.Empty(t, preview.ImportBatchID)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "backup.json", jsonBody,
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var res struct {
		SetupsUpserted int `json:"setups_upserted"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.Equal(t, 1, res.SetupsUpserted)

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var setups []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	var restored map[string]any
	for _, st := range setups {
		if st["name"] == "VWAP Fade" {
			restored = st
			break
		}
	}
	require.NotNil(t, restored)
	require.Equal(t, "Mean reversion at VWAP", restored["thesis"])
	require.Equal(t, "SPY", restored["symbol"])
	require.Equal(t, "short", restored["direction"])
	require.Equal(t, 500.0, restored["target_price"])
	checklist := restored["checklist"].([]any)
	require.Len(t, checklist, 2)
}

func TestExportLegacyTradesAlias(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-alias@x.com")
	acc := accountID(t, s, tok)
	_ = closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodGet, "/api/v1/exports/trades?account_id="+acc+"&format=json", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	require.Equal(t, float64(1), payload["format_version"])
}

func TestExportRequiresAccount(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-bad@x.com")
	rec := do(s, http.MethodGet, "/api/v1/exports?format=json", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestExportJSONOmitAccount(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-omit@x.com")
	acc := accountID(t, s, tok)
	_ = closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=json&omit_account=1", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	_, hasAccount := payload["account"]
	require.False(t, hasAccount)
	_, hasAccountID := payload["account_id"]
	require.False(t, hasAccountID)
	_, hasAccountName := payload["account_name"]
	require.False(t, hasAccountName)

	trades := payload["trades"].([]any)
	require.NotEmpty(t, trades)
	trade := trades[0].(map[string]any)
	require.Equal(t, "", trade["account_id"])
	fills := trade["fills"].([]any)
	require.NotEmpty(t, fills)
	fill := fills[0].(map[string]any)
	require.Equal(t, "", fill["account_id"])
}

func TestExportOmitAccountRejectedForCSV(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "export-omit-csv@x.com")
	acc := accountID(t, s, tok)
	rec := do(s, http.MethodGet, "/api/v1/exports?account_id="+acc+"&format=csv&omit_account=1", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestJSONImportDefersAccountCreationUntilCommit(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "json-bypass@x.com")

	// Ensure this user starts with no accounts (setup may not create one).
	rec := do(s, http.MethodGet, "/api/v1/accounts", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var existing []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &existing))
	require.Empty(t, existing)

	jsonBody := `{
		"account": {
			"name": "Imported Backup",
			"broker": "IBKR",
			"account_type": "cash",
			"base_currency": "USD",
			"starting_balance": 1000
		},
		"trades": [{
			"symbol": "AAPL",
			"instrument_type": "stock",
			"direction": "long",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "2026-01-01T11:00:00Z",
			"qty_opened": 10,
			"avg_entry_price": 10,
			"avg_exit_price": 12,
			"net_pnl": 20
		}]
	}`

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "backup.json", jsonBody, nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		ImportBatchID  string         `json:"import_batch_id"`
		AccountID      string         `json:"account_id"`
		PendingAccount map[string]any `json:"pending_account"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.Empty(t, preview.ImportBatchID)
	require.Empty(t, preview.AccountID)
	require.Equal(t, "Imported Backup", preview.PendingAccount["name"])
	require.Equal(t, "IBKR", preview.PendingAccount["broker"])

	// Preview must not create the account yet.
	rec = do(s, http.MethodGet, "/api/v1/accounts", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &existing))
	require.Empty(t, existing)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "backup.json", jsonBody, nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var result struct {
		AccountID string `json:"account_id"`
		Trades    int    `json:"trades"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
	require.NotEmpty(t, result.AccountID)

	rec = do(s, http.MethodGet, "/api/v1/accounts/"+result.AccountID, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var account map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &account))
	require.Equal(t, "Imported Backup", account["name"])
	require.Equal(t, "IBKR", account["broker"])
}

func TestJSONImportPreviewRequiresAccountIDWithoutMeta(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "json-need-acc@x.com")

	jsonBody := `[{"symbol":"AAPL","side":"buy","qty":1,"price":10,"executed_at":"2026-01-01T10:00:00Z"}]`
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "fills.json", jsonBody, nil))
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
}
