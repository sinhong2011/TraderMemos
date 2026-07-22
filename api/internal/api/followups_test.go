package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeleteMissingAccountReturns404(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "d@x.com")
	_ = accountID(t, s, tok)
	rec := do(s, http.MethodDelete, "/api/v1/accounts/does-not-exist", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteLastAccountReturns409(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "last@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodDelete, "/api/v1/accounts/"+acc, "", tok)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
}

func TestDeleteAccountSucceedsWhenAnotherRemains(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "two@x.com")
	first := accountID(t, s, tok)
	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Secondary","base_currency":"USD","starting_balance":5000}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var second struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &second))

	rec = do(s, http.MethodDelete, "/api/v1/accounts/"+first, "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/accounts", "", tok)
	var accs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &accs))
	require.Len(t, accs, 1)
	require.Equal(t, second.ID, accs[0]["id"])
}

func TestUpdateAccountNameAndBroker(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "upd-acc@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPut, "/api/v1/accounts/"+acc,
		`{"name":"Testing","broker":"FUTU"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var updated map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &updated))
	require.Equal(t, "Testing", updated["name"])
	require.Equal(t, "FUTU", updated["broker"])

	rec = do(s, http.MethodGet, "/api/v1/accounts/"+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "Testing", got["name"])
	require.Equal(t, "FUTU", got["broker"])
}

func TestCreateAccountSeedsOpeningDeposit(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "open-dep@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodGet, "/api/v1/cash-transactions?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var cash []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cash))
	require.Len(t, cash, 1)
	require.Equal(t, "deposit", cash[0]["type"])
	require.Equal(t, 10000.0, cash[0]["amount"])
	require.Equal(t, "Opening balance", cash[0]["note"])
}

func TestUpdateCashTransaction(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "cash-upd@x.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPost, "/api/v1/cash-transactions",
		`{"account_id":"`+acc+`","type":"deposit","amount":500,"currency":"USD","occurred_at":"2026-01-02T00:00:00Z","note":"top up"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	id := created["id"].(string)

	rec = do(s, http.MethodPut, "/api/v1/cash-transactions/"+id,
		`{"type":"withdrawal","amount":120,"currency":"USD","occurred_at":"2026-01-03T00:00:00Z","note":"out"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var updated map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &updated))
	require.Equal(t, "withdrawal", updated["type"])
	require.Equal(t, 120.0, updated["amount"])
	require.Equal(t, "out", updated["note"])
}

func TestUpdateMissingAccountReturns404(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "upd-miss@x.com")
	_ = accountID(t, s, tok)
	rec := do(s, http.MethodPut, "/api/v1/accounts/does-not-exist",
		`{"name":"X","broker":"IBKR"}`, tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestUpdateMissingTagReturns404(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "ut@x.com")
	rec := do(s, http.MethodPatch, "/api/v1/tags/nope", `{"name":"x"}`, tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestBadDateFilterReturns400(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "f@x.com")
	acc := accountID(t, s, tok)
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc+"&from=notadate", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/analytics/summary?from=2026-13-99", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
