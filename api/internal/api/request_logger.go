package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

func requestLogger(lg *slog.Logger) echo.MiddlewareFunc {
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
				"uri", req.RequestURI,
				"status", status,
				"latency", time.Since(start).Round(time.Millisecond).String(),
				"id", res.Header().Get(echo.HeaderXRequestID),
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
