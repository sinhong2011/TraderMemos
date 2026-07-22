package api

import (
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
				"latency", time.Since(start).Round(time.Millisecond).String(),
				"id", res.Header().Get(echo.HeaderXRequestID),
			}
			if params := pathParams(c); len(params) > 0 {
				attrs = append(attrs, "params", params)
			}
			if raw := rawQuery(req); raw != "" {
				attrs = append(attrs, "query", raw)
			}

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
