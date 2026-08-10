package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
)

// The SPA reads every failure through the {"error":{code,message,details}}
// envelope, so these lock the wire format against the error handler — the one
// place a framework change can silently reshape every error response.

func decodeEnvelope(t *testing.T, rec *httptest.ResponseRecorder) APIError {
	t.Helper()
	var env struct {
		Error APIError `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env), rec.Body.String())
	return env.Error
}

func serveTestRoute(t *testing.T, path string, h echo.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	s := New(Deps{})
	s.Echo.GET(path, h)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestErrorHandlerRendersFailEnvelope(t *testing.T) {
	rec := serveTestRoute(t, "/test/fail", func(c *echo.Context) error {
		return Fail(http.StatusUnprocessableEntity, "invalid_symbol", "symbol is required", map[string]string{"field": "symbol"})
	})

	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "invalid_symbol", got.Code)
	require.Equal(t, "symbol is required", got.Message)
	require.Equal(t, map[string]any{"field": "symbol"}, got.Details)
}

// A wrapped cause is for the log only — leaking it would hand the client
// internal detail (query text, file paths) it must never see.
func TestErrorHandlerHidesWrappedCause(t *testing.T) {
	rec := serveTestRoute(t, "/test/wrapped", func(c *echo.Context) error {
		return Fail(http.StatusInternalServerError, "internal", "could not save trade", nil).
			Wrap(errors.New("pq: relation \"trades\" does not exist"))
	})

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "internal", got.Code)
	require.Equal(t, "could not save trade", got.Message)
	require.Nil(t, got.Details)
	require.NotContains(t, rec.Body.String(), "does not exist")
}

func TestErrorHandlerRendersPlainErrorAsGeneric500(t *testing.T) {
	rec := serveTestRoute(t, "/test/plain", func(c *echo.Context) error {
		return errors.New("kaput")
	})

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "internal", got.Code)
	require.Equal(t, "internal server error", got.Message)
	require.NotContains(t, rec.Body.String(), "kaput")
}

// Recover hands the panic on as an error carrying the stack; none of it may
// reach the client.
func TestErrorHandlerRendersPanicAsGeneric500(t *testing.T) {
	rec := serveTestRoute(t, "/test/panic", func(c *echo.Context) error {
		panic("boom")
	})

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "internal", got.Code)
	require.Equal(t, "internal server error", got.Message)
	require.NotContains(t, rec.Body.String(), "boom")
	require.NotContains(t, rec.Body.String(), "goroutine")
}

// Echo's own routing errors carry a status but no message of ours; they must
// still arrive in the envelope rather than echo's default body.
func TestErrorHandlerWrapsEchoRoutingErrors(t *testing.T) {
	s := New(Deps{})
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/no-such-route", nil))

	require.Equal(t, http.StatusNotFound, rec.Code)
	got := decodeEnvelope(t, rec)
	require.Equal(t, "error", got.Code)
	require.Equal(t, "Not Found", got.Message)
}

// StatusCode is what echo (and the request logger) reads the status off before
// the handler writes anything.
func TestFailReportsStatusCode(t *testing.T) {
	err := Fail(http.StatusConflict, "duplicate", "already exists", nil)
	require.Equal(t, http.StatusConflict, echo.StatusCode(err))

	cause := errors.New("root cause")
	require.ErrorIs(t, Fail(http.StatusInternalServerError, "internal", "boom", nil).Wrap(cause), cause)
}
