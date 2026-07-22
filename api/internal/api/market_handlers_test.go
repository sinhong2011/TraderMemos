package api_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMarketBarsValidation(t *testing.T) {
	s := testServer(t)
	token := registerAndLogin(t, s, "market@example.com")

	rec := do(s, http.MethodGet, "/api/v1/market/bars?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z", "", token)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/market/bars?symbol=AAPL&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z", "", token)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/market/bars?symbol=E2E8500&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z", "", token)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"bars":[]`)
	require.Contains(t, rec.Body.String(), `"provider":"skipped"`)
}

func TestMarketFxValidation(t *testing.T) {
	s := testServer(t)
	token := registerAndLogin(t, s, "fx@example.com")

	rec := do(s, http.MethodGet, "/api/v1/market/fx?from=USD", "", token)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/market/fx?from=USD&to=USD", "", token)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"rate":1`)
	require.Contains(t, rec.Body.String(), `"provider":"identity"`)
}
