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
