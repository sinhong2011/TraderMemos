package api_test

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

func TestRequestLoggerIncludesRouteParamsAndQuery(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	e := echo.New()
	e.HideBanner = true
	e.Use(api.RequestLogger(lg))
	e.GET("/api/v1/trades/:id", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/trades/abc-123?account_id=acc1&from=2026-01-01", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	out := buf.String()
	require.Contains(t, out, "route=/api/v1/trades/:id")
	require.Contains(t, out, "params=map[id:abc-123]")
	require.Contains(t, out, `query="account_id=acc1&from=2026-01-01"`)
	require.NotContains(t, out, "uri=")
}

func TestRequestLoggerOmitsEmptyParamsAndQuery(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	e := echo.New()
	e.HideBanner = true
	e.Use(api.RequestLogger(lg))
	e.GET("/api/v1/setup/status", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/setup/status", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	out := buf.String()
	require.Contains(t, out, "route=/api/v1/setup/status")
	require.NotContains(t, out, "params=")
	require.NotContains(t, out, "query=")
}
