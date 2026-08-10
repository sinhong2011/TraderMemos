package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
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

// UseRecorder logs *where* a token was used from. Optional: a TokenStore that
// does not implement it simply keeps the last-used stamp and nothing else.
type UseRecorder interface {
	LatestAccessTokenUse(ctx context.Context, tokenID string) (store.AccessTokenUse, error)
	RecordAccessTokenUse(ctx context.Context, arg store.RecordAccessTokenUseParams) error
	PruneAccessTokenUses(ctx context.Context, arg store.PruneAccessTokenUsesParams) error
}

const (
	// A token driving a 30-second cron would otherwise write 2 880 rows a day
	// that all say the same thing. Within this window the client is assumed
	// unchanged — unless the IP or user-agent actually differs, which is the
	// event worth catching.
	useRecordInterval = 10 * time.Minute
	// Enough history to spot an unfamiliar client without growing forever.
	useHistoryLimit = 50
)

func Middleware(j *JWT, users UserStore, tokens TokenStore) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			raw := strings.TrimPrefix(h, "Bearer ")
			if IsPAT(raw) {
				uid, err := authenticatePAT(c, tokens, raw)
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

func authenticatePAT(c *echo.Context, tokens TokenStore, secret string) (string, error) {
	if tokens == nil {
		return "", echo.ErrUnauthorized
	}
	ctx := c.Request().Context()
	row, err := tokens.GetAccessTokenByHash(ctx, HashPAT(secret))
	if err != nil {
		return "", err
	}
	if row.ExpiresAt.Valid && !row.ExpiresAt.Time.After(time.Now()) {
		return "", echo.ErrUnauthorized
	}
	// Best-effort last-used stamp; auth must not fail if the update errors.
	_ = tokens.TouchAccessTokenLastUsed(ctx, row.ID)
	recordUse(ctx, tokens, row.ID, c.RealIP(), c.Request().UserAgent())
	return row.UserID, nil
}

// recordUse appends a row when the client looks new — a different IP or
// user-agent, or the same one after `useRecordInterval`. Entirely best-effort:
// this is an audit trail, and failing to write it must never cost someone
// access to their own journal.
func recordUse(ctx context.Context, tokens TokenStore, tokenID, ip, agent string) {
	rec, ok := tokens.(UseRecorder)
	if !ok {
		return
	}
	last, err := rec.LatestAccessTokenUse(ctx, tokenID)
	// A missing row is the first use, not a failure — fall through and write.
	if err == nil && last.Ip == ip && last.UserAgent == agent &&
		time.Since(last.UsedAt) < useRecordInterval {
		return
	}
	if err := rec.RecordAccessTokenUse(ctx, store.RecordAccessTokenUseParams{
		ID:        uuid.NewString(),
		TokenID:   tokenID,
		Ip:        ip,
		UserAgent: agent,
	}); err != nil {
		return
	}
	_ = rec.PruneAccessTokenUses(ctx, store.PruneAccessTokenUsesParams{
		TokenID:   tokenID,
		TokenID_2: tokenID,
		Limit:     useHistoryLimit,
	})
}

func UserID(c *echo.Context) string {
	if v, ok := c.Get(userKey).(string); ok {
		return v
	}
	return ""
}
