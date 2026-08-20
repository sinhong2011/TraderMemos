package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdateAndDeleteExecution(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "edit-fill@x.com")
	acc := accountID(t, s, tok)

	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"fees":1,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":12,"fees":1,"executed_at":"2026-01-01T11:00:00Z"}`
	buyRec := do(s, http.MethodPost, "/api/v1/executions", buy, tok)
	require.Equal(t, http.StatusCreated, buyRec.Code, buyRec.Body.String())
	sellRec := do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	require.Equal(t, http.StatusCreated, sellRec.Code, sellRec.Body.String())

	var created struct {
		ExecutionID string `json:"execution_id"`
		TradeID     string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal(buyRec.Body.Bytes(), &created))
	require.NotEmpty(t, created.ExecutionID)
	require.NotEmpty(t, created.TradeID)

	// Duplicate create is idempotent — same execution/trade ids, HTTP 200.
	dupRec := do(s, http.MethodPost, "/api/v1/executions", buy, tok)
	require.Equal(t, http.StatusOK, dupRec.Code, dupRec.Body.String())
	var duped struct {
		ExecutionID string `json:"execution_id"`
		TradeID     string `json:"trade_id"`
		Deduped     string `json:"deduped"`
	}
	require.NoError(t, json.Unmarshal(dupRec.Body.Bytes(), &duped))
	require.Equal(t, created.ExecutionID, duped.ExecutionID)
	require.Equal(t, created.TradeID, duped.TradeID)
	require.Equal(t, "true", duped.Deduped)

	// Raise exit price → higher P&L after regroup.
	var sellCreated struct {
		ExecutionID string `json:"execution_id"`
		TradeID     string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal(sellRec.Body.Bytes(), &sellCreated))

	patch := `{"side":"sell","quantity":100,"price":15,"fees":1,"executed_at":"2026-01-01T11:00:00Z"}`
	rec := do(s, http.MethodPatch, "/api/v1/executions/"+sellCreated.ExecutionID, patch, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var updated struct {
		ExecutionID string `json:"execution_id"`
		TradeID     string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &updated))
	require.Equal(t, sellCreated.ExecutionID, updated.ExecutionID)
	require.NotEmpty(t, updated.TradeID)

	rec = do(s, http.MethodGet, "/api/v1/trades/"+updated.TradeID, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var detail map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.Equal(t, 500.0-2.0, detail["net_pnl"]) // (15-10)*100 - fees

	// Delete exit fill → open trade remains.
	rec = do(s, http.MethodDelete, "/api/v1/executions/"+sellCreated.ExecutionID, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var deleted struct {
		TradeID string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &deleted))
	require.NotEmpty(t, deleted.TradeID)

	rec = do(s, http.MethodGet, "/api/v1/trades/"+deleted.TradeID, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.Equal(t, "open", detail["status"])

	// Delete remaining fill → no trade left.
	rec = do(s, http.MethodDelete, "/api/v1/executions/"+created.ExecutionID, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &deleted))
	require.Empty(t, deleted.TradeID)

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 0)
}

func TestUpdateExecutionNotFound(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "missing-fill@x.com")
	patch := `{"side":"buy","quantity":1,"price":1,"fees":0,"executed_at":"2026-01-01T10:00:00Z"}`
	rec := do(s, http.MethodPatch, "/api/v1/executions/00000000-0000-0000-0000-000000000000", patch, tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

// Two strikes of one underlying, filled at the same time/price/quantity, are
// different fills. Hashing on the bare symbol made the second one dedup into
// the first and hand back the wrong trade; the key now carries the contract.
func TestCreateExecutionSeparatesOptionContracts(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "option-fills@x.com")
	acc := accountID(t, s, tok)

	fill := func(strike string) string {
		return `{"account_id":"` + acc + `","symbol":"MU","instrument_type":"option",` +
			`"side":"buy","quantity":5,"price":3.84,"executed_at":"2026-08-17T13:45:00Z",` +
			`"details":{"option_right":"call","strike":"` + strike + `","expiry":"2026-08-17"}}`
	}

	first := do(s, http.MethodPost, "/api/v1/executions", fill("1030"), tok)
	require.Equal(t, http.StatusCreated, first.Code, first.Body.String())
	second := do(s, http.MethodPost, "/api/v1/executions", fill("1040"), tok)
	require.Equal(t, http.StatusCreated, second.Code, second.Body.String())

	var a, b struct {
		ExecutionID string `json:"execution_id"`
	}
	require.NoError(t, json.Unmarshal(first.Body.Bytes(), &a))
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &b))
	require.NotEqual(t, a.ExecutionID, b.ExecutionID)

	// The same contract twice still dedups.
	again := do(s, http.MethodPost, "/api/v1/executions", fill("1030"), tok)
	require.Equal(t, http.StatusOK, again.Code, again.Body.String())
	var duped struct {
		ExecutionID string `json:"execution_id"`
		Deduped     string `json:"deduped"`
	}
	require.NoError(t, json.Unmarshal(again.Body.Bytes(), &duped))
	require.Equal(t, "true", duped.Deduped)
	require.Equal(t, a.ExecutionID, duped.ExecutionID)
}
