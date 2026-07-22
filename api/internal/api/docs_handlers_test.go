package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDocsAndOpenAPI(t *testing.T) {
	s := testServer(t)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	body := rec.Body.String()
	require.Contains(t, body, "openapi:")
	require.Contains(t, body, "/api/v1/access-tokens")
	require.Contains(t, body, "tm_pat_")

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/docs", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	html := rec.Body.String()
	require.Contains(t, html, "@scalar/api-reference@1.63.0")
	require.Contains(t, html, "/openapi.yaml")
	require.True(t, strings.Contains(html, "createApiReference"))
}
