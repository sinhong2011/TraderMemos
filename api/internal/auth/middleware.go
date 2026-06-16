package auth

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

const userKey = "uid"

func Middleware(j *JWT) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			uid, err := j.Parse(strings.TrimPrefix(h, "Bearer "))
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}
			c.Set(userKey, uid)
			return next(c)
		}
	}
}

func UserID(c echo.Context) string {
	if v, ok := c.Get(userKey).(string); ok {
		return v
	}
	return ""
}
