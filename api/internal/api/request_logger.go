package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

func RequestLogger(lg *slog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Path() == "/healthz" {
				return next(c)
			}

			start := time.Now()
			req := c.Request()
			err := next(c)
			if err != nil {
				c.Error(err)
			}

			res := c.Response()
			status := res.Status
			attrs := []any{
				"method", req.Method,
				"route", c.Path(),
				"status", status,
				"latency_ms", float64(time.Since(start).Microseconds()) / 1000.0,
				"id", res.Header().Get(echo.HeaderXRequestID),
			}
			if params := pathParams(c); len(params) > 0 {
				attrs = append(attrs, "params", params)
			}
			if raw := rawQuery(req); raw != "" {
				attrs = append(attrs, "query", raw)
			}
			attrs = append(attrs, errAttrs(err)...)

			switch {
			case status >= http.StatusInternalServerError:
				lg.Error("request", attrs...)
			case status >= http.StatusBadRequest:
				lg.Warn("request", attrs...)
			default:
				lg.Info("request", attrs...)
			}
			return nil
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
	he, ok := err.(*echo.HTTPError)
	if !ok {
		return []any{"err", err.Error()}
	}
	var attrs []any
	if env, ok := he.Message.(errEnvelope); ok {
		attrs = append(attrs, "err_code", env.Error.Code, "err", env.Error.Message)
		if env.Error.Details != nil {
			attrs = append(attrs, "err_details", env.Error.Details)
		}
	} else {
		attrs = append(attrs, "err", fmt.Sprint(he.Message))
	}
	if he.Internal != nil {
		attrs = append(attrs, "err_internal", he.Internal.Error())
	}
	return attrs
}

func pathParams(c echo.Context) map[string]string {
	names := c.ParamNames()
	if len(names) == 0 {
		return nil
	}
	out := make(map[string]string, len(names))
	for _, name := range names {
		if v := c.Param(name); v != "" {
			out[name] = v
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
