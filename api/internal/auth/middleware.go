package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/store"
)

const userKey = "uid"

type UserStore interface {
	GetUserByID(ctx context.Context, id string) (store.User, error)
}

// TokenStore looks up personal access tokens by hash and records last use.
type TokenStore interface {
	GetAccessTokenByHash(ctx context.Context, tokenHash string) (store.AccessToken, error)
	TouchAccessTokenLastUsed(ctx context.Context, id string) error
}

func Middleware(j *JWT, users UserStore, tokens TokenStore) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			raw := strings.TrimPrefix(h, "Bearer ")
			if IsPAT(raw) {
				uid, err := authenticatePAT(c.Request().Context(), tokens, raw)
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
				}
				c.Set(userKey, uid)
				return next(c)
			}
			uid, err := j.Parse(raw, TokenAccess)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}
			if users != nil {
				if _, err := users.GetUserByID(c.Request().Context(), uid); err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
				}
			}
			c.Set(userKey, uid)
			return next(c)
		}
	}
}

func authenticatePAT(ctx context.Context, tokens TokenStore, secret string) (string, error) {
	if tokens == nil {
		return "", echo.ErrUnauthorized
	}
	row, err := tokens.GetAccessTokenByHash(ctx, HashPAT(secret))
	if err != nil {
		return "", err
	}
	if row.ExpiresAt.Valid && !row.ExpiresAt.Time.After(time.Now()) {
		return "", echo.ErrUnauthorized
	}
	// Best-effort last-used stamp; auth must not fail if the update errors.
	_ = tokens.TouchAccessTokenLastUsed(ctx, row.ID)
	return row.UserID, nil
}

func UserID(c echo.Context) string {
	if v, ok := c.Get(userKey).(string); ok {
		return v
	}
	return ""
}
