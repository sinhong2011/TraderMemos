package api_test

import (
	"bytes"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

func TestRequestLoggerIncludesRouteParamsAndQuery(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	e := echo.New()
	e.Use(api.RequestLogger(lg))
	e.GET("/api/v1/trades/:id", func(c *echo.Context) error {
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
	e.Use(api.RequestLogger(lg))
	e.GET("/api/v1/setup/status", func(c *echo.Context) error {
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

func TestRequestLoggerIncludesErrorCause(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	e := echo.New()
	e.Use(api.RequestLogger(lg))
	e.POST("/api/v1/import", func(c *echo.Context) error {
		return api.Fail(http.StatusInternalServerError, "internal", "could not import", "disk full")
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/import", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusInternalServerError, rec.Code)

	out := buf.String()
	require.Contains(t, out, "level=ERROR")
	require.Contains(t, out, "err_code=internal")
	require.Contains(t, out, `err="could not import"`)
	require.Contains(t, out, `err_details="disk full"`)
	require.Contains(t, out, "latency_ms=")
}

// A recovered panic must land in the request's own log line — with route,
// status and latency alongside the stack — rather than a detached entry.
func TestRequestLoggerRecordsPanicStack(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	s := api.New(api.Deps{Logger: lg})
	s.Echo.GET("/test/panic", func(c *echo.Context) error { panic("boom") })

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/test/panic", nil))
	require.Equal(t, http.StatusInternalServerError, rec.Code)

	out := buf.String()
	require.Contains(t, out, "level=ERROR")
	require.Contains(t, out, "route=/test/panic")
	require.Contains(t, out, "status=500")
	require.Contains(t, out, "latency_ms=")
	require.Contains(t, out, "err=boom")
	require.Contains(t, out, "goroutine")
	// One line for the whole request, not a separate panic entry.
	require.Equal(t, 1, strings.Count(out, "msg=request"))
}

func TestRequestLoggerIncludesPlainErrors(t *testing.T) {
	var buf bytes.Buffer
	lg := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	e := echo.New()
	e.Use(api.RequestLogger(lg))
	e.GET("/api/v1/boom", func(c *echo.Context) error {
		return errors.New("kaput")
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/boom", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.Contains(t, buf.String(), "err=kaput")
}
