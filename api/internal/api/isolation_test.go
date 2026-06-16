package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// createTag creates a tag for the token's user and returns its id.
func createTag(t *testing.T, s *api.Server, token, name string) string {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/tags", `{"name":"`+name+`"}`, token)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var tag struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tag))
	return tag.ID
}

func TestCannotInsertExecutionIntoForeignAccount(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@i.com")
	tokB := registerAndLogin(t, s, "b@i.com")
	accA := accountID(t, s, tokA)

	// user B tries to insert an execution into user A's account
	body := `{"account_id":"` + accA + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	rec := do(s, http.MethodPost, "/api/v1/executions", body, tokB)
	require.Equal(t, http.StatusNotFound, rec.Code)

	// user A's account has no executions as a result
	rec = do(s, http.MethodGet, "/api/v1/executions?account_id="+accA, "", tokA)
	var execs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &execs))
	require.Len(t, execs, 0)
}

func TestCannotPostCashIntoForeignAccount(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@c.com")
	tokB := registerAndLogin(t, s, "b@c.com")
	accA := accountID(t, s, tokA)

	body := `{"account_id":"` + accA + `","type":"deposit","amount":1000,"occurred_at":"2026-01-01T09:00:00Z"}`
	rec := do(s, http.MethodPost, "/api/v1/cash-transactions", body, tokB)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCannotAttachForeignTag(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@t.com")
	tokB := registerAndLogin(t, s, "b@t.com")
	accB := accountID(t, s, tokB)

	// user A owns a tag
	foreignTag := createTag(t, s, tokA, "A-secret")

	// user B has a closed trade
	buy := `{"account_id":"` + accB + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":10,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + accB + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":10,"price":11,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tokB).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, tokB).Code)
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+accB, "", tokB)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)
	tradeID := trades[0]["id"].(string)

	// user B tries to attach user A's tag -> rejected
	rec = do(s, http.MethodPatch, "/api/v1/trades/"+tradeID, `{"tag_ids":["`+foreignTag+`"]}`, tokB)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
