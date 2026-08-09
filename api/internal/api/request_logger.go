package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

// RequestLogger emits one structured line per request. It builds on echo's
// RequestLogger middleware rather than wrapping the handler by hand: echo
// resolves the final status (including the status an error carries, before the
// error handler has written anything), which is not something a middleware can
// read off the ResponseWriter on its own.
func RequestLogger(lg *slog.Logger) echo.MiddlewareFunc {
	return middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		// The SPA polls /healthz continuously; logging it drowns everything else.
		Skipper:      func(c *echo.Context) bool { return c.Path() == "/healthz" },
		LogMethod:    true,
		LogRoutePath: true,
		LogStatus:    true,
		LogLatency:   true,
		LogRequestID: true,
		// Run the error handler before logging so the logged status is the one
		// actually sent, and the error is still ours to inspect.
		HandleError: true,
		LogValuesFunc: func(c *echo.Context, v middleware.RequestLoggerValues) error {
			attrs := []any{
				"method", v.Method,
				"route", v.RoutePath,
				"status", v.Status,
				"latency_ms", float64(v.Latency.Microseconds()) / 1000.0,
				"id", v.RequestID,
			}
			if params := pathParams(c); len(params) > 0 {
				attrs = append(attrs, "params", params)
			}
			if raw := rawQuery(c.Request()); raw != "" {
				attrs = append(attrs, "query", raw)
			}
			attrs = append(attrs, errAttrs(v.Error)...)

			switch {
			case v.Status >= http.StatusInternalServerError:
				lg.Error("request", attrs...)
			case v.Status >= http.StatusBadRequest:
				lg.Warn("request", attrs...)
			default:
				lg.Info("request", attrs...)
			}
			return nil
		},
	})
}

// ContextLogger stores a request-scoped logger on the context, tagged with the
// request id. Handlers should log through c.Logger() rather than a
// server-wide logger: without the id, a warning raised mid-handler cannot be
// matched to the request line that carries its route, status and latency.
//
// Echo resets the context logger to the server one between requests, so the
// tagged logger never leaks across the pooled contexts.
func ContextLogger(lg *slog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if id := c.Response().Header().Get(echo.HeaderXRequestID); id != "" {
				c.SetLogger(lg.With("id", id))
			} else {
				c.SetLogger(lg)
			}
			return next(c)
		}
	}
}

// errAttrs flattens a handler error into log attributes so every 4xx/5xx
// line carries its cause — the response envelope hides it from the log
// otherwise, and a bare status is undebuggable after the fact.
func errAttrs(err error) []any {
	if err == nil {
		return nil
	}

	// A recovered panic arrives with the trace attached. Keep it as its own
	// attribute — PanicStackError.Error() inlines the whole stack into the
	// message, which is unreadable in a log line.
	var panicErr *middleware.PanicStackError
	if errors.As(err, &panicErr) {
		return []any{"err", panicErr.Err.Error(), "stack", string(panicErr.Stack)}
	}

	var apiErr *Error
	if errors.As(err, &apiErr) {
		attrs := []any{"err_code", apiErr.Payload.Code, "err", apiErr.Payload.Message}
		if apiErr.Payload.Details != nil {
			attrs = append(attrs, "err_details", apiErr.Payload.Details)
		}
		if apiErr.cause != nil {
			attrs = append(attrs, "err_internal", apiErr.cause.Error())
		}
		return attrs
	}

	var he *echo.HTTPError
	if errors.As(err, &he) {
		attrs := []any{"err", he.Message}
		if cause := he.Unwrap(); cause != nil {
			attrs = append(attrs, "err_internal", cause.Error())
		}
		return attrs
	}

	return []any{"err", err.Error()}
}

func pathParams(c *echo.Context) map[string]string {
	values := c.PathValues()
	if len(values) == 0 {
		return nil
	}
	out := make(map[string]string, len(values))
	for _, pv := range values {
		if pv.Value != "" {
			out[pv.Name] = pv.Value
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func rawQuery(req *http.Request) string {
	if req.URL == nil {
		return ""
	}
	return req.URL.RawQuery
}
