package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type errEnvelope struct {
	Error APIError `json:"error"`
}

// Fail returns a typed API error with an HTTP status.
func Fail(status int, code, msg string, details any) *echo.HTTPError {
	return &echo.HTTPError{Code: status, Message: errEnvelope{APIError{code, msg, details}}}
}

func errorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	if he, ok := err.(*echo.HTTPError); ok {
		if env, ok := he.Message.(errEnvelope); ok {
			_ = c.JSON(he.Code, env)
			return
		}
		_ = c.JSON(he.Code, errEnvelope{APIError{"error", http.StatusText(he.Code), he.Message}})
		return
	}
	_ = c.JSON(http.StatusInternalServerError, errEnvelope{APIError{"internal", "internal server error", nil}})
}
