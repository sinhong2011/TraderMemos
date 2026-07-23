package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/version"
)

func TestHealthz(t *testing.T) {
	s := New(Deps{})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"status":"ok"`)
	require.Contains(t, rec.Body.String(), `"version":"`+version.Version+`"`)
	require.Contains(t, rec.Body.String(), `"go":`)
}

func TestCORSPreflightWhenConfigured(t *testing.T) {
	s := New(Deps{CORSOrigins: []string{"https://app.example.com", "https://*.vercel.app"}})
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNoContent, rec.Code)
	require.Equal(t, "https://app.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
	allowHeaders := strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers"))
	require.Contains(t, allowHeaders, "authorization")

	req2 := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req2.Header.Set("Origin", "https://tm-git-abc123.vercel.app")
	req2.Header.Set("Access-Control-Request-Method", "POST")
	rec2 := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec2, req2)
	require.Equal(t, http.StatusNoContent, rec2.Code)
	require.Equal(t, "https://tm-git-abc123.vercel.app", rec2.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSDisabledByDefault(t *testing.T) {
	s := New(Deps{})
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}
