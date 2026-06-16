package api_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeleteMissingAccountReturns404(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "d@x.com")
	rec := do(s, http.MethodDelete, "/api/v1/accounts/does-not-exist", "", tok)
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
