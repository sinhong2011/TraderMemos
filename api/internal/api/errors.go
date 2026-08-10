package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
)

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type errEnvelope struct {
	Error APIError `json:"error"`
}

// Error is the transport error every handler in this package returns: an HTTP
// status paired with the envelope the SPA parses. Echo v5's HTTPError carries
// only a plain string message, so the envelope lives on our own type — which
// echo picks the status off via the HTTPStatusCoder interface — and errorHandler
// renders it.
type Error struct {
	Status  int
	Payload APIError
	// cause is the underlying failure. It reaches the log through errAttrs and
	// is never written to the response, so it can hold internal detail.
	cause error
}

func (e *Error) Error() string {
	if e.cause == nil {
		return fmt.Sprintf("code=%d, %s: %s", e.Status, e.Payload.Code, e.Payload.Message)
	}
	return fmt.Sprintf("code=%d, %s: %s: %v", e.Status, e.Payload.Code, e.Payload.Message, e.cause)
}

// StatusCode satisfies echo.HTTPStatusCoder, so echo resolves the response
// status from the error even before errorHandler runs (the request logger
// relies on this for an accurate status).
func (e *Error) StatusCode() int { return e.Status }

func (e *Error) Unwrap() error { return e.cause }

// Wrap attaches the underlying cause. It is logged with the request but stays
// out of the response body.
func (e *Error) Wrap(cause error) *Error {
	e.cause = cause
	return e
}

// Fail returns a typed API error with an HTTP status.
func Fail(status int, code, msg string, details any) *Error {
	return &Error{Status: status, Payload: APIError{code, msg, details}}
}

func errorHandler(c *echo.Context, err error) {
	if res, _ := echo.UnwrapResponse(c.Response()); res != nil && res.Committed {
		return
	}

	var apiErr *Error
	if errors.As(err, &apiErr) {
		_ = c.JSON(apiErr.Status, errEnvelope{apiErr.Payload})
		return
	}

	var he *echo.HTTPError
	if errors.As(err, &he) {
		_ = c.JSON(he.Code, errEnvelope{APIError{Code: "error", Message: he.Message}})
		return
	}

	// Echo's own sentinels (ErrNotFound, ErrMethodNotAllowed, …) carry a status
	// but no message. Anything without a status is a bug on our side: report it
	// as a bare 500 so an internal error never reaches the client.
	if status := echo.StatusCode(err); status > 0 && status < http.StatusInternalServerError {
		_ = c.JSON(status, errEnvelope{APIError{Code: "error", Message: http.StatusText(status)}})
		return
	}
	_ = c.JSON(http.StatusInternalServerError, errEnvelope{APIError{Code: "internal", Message: "internal server error"}})
}
