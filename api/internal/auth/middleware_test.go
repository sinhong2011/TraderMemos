package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/store"
)

type testUserStore struct {
	getUserByID func(ctx context.Context, id string) (store.User, error)
}

func (s testUserStore) GetUserByID(ctx context.Context, id string) (store.User, error) {
	return s.getUserByID(ctx, id)
}

type testTokenStore struct {
	getByHash func(ctx context.Context, hash string) (store.AccessToken, error)
	touched   []string
}

func (s *testTokenStore) GetAccessTokenByHash(ctx context.Context, tokenHash string) (store.AccessToken, error) {
	return s.getByHash(ctx, tokenHash)
}

func (s *testTokenStore) TouchAccessTokenLastUsed(ctx context.Context, id string) error {
	s.touched = append(s.touched, id)
	return nil
}

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	h := Middleware(m, nil, nil)(func(c *echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	require.Error(t, h(e.NewContext(req, rec)))
}

func TestMiddlewareInjectsUserID(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	tok, _ := m.Mint("u-1", time.Minute, TokenAccess, "")
	var seen string
	h := Middleware(m, nil, nil)(func(c *echo.Context) error {
		seen = UserID(c)
		return c.String(200, "ok")
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	require.NoError(t, h(e.NewContext(req, httptest.NewRecorder())))
	require.Equal(t, "u-1", seen)
}

func TestMiddlewareRejectsTokenWhenUserDeleted(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	tok, _ := m.Mint("u-missing", time.Minute, TokenAccess, "")
	users := testUserStore{
		getUserByID: func(ctx context.Context, id string) (store.User, error) {
			return store.User{}, errors.New("not found")
		},
	}
	h := Middleware(m, users, nil)(func(c *echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	err := h(e.NewContext(req, httptest.NewRecorder()))
	require.Error(t, err)
	httpErr, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	require.Equal(t, http.StatusUnauthorized, httpErr.Code)
}

func TestMiddlewareAcceptsPAT(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	secret, err := GeneratePAT()
	require.NoError(t, err)
	tokens := &testTokenStore{
		getByHash: func(ctx context.Context, hash string) (store.AccessToken, error) {
			require.Equal(t, HashPAT(secret), hash)
			return store.AccessToken{ID: "tok-1", UserID: "u-pat"}, nil
		},
	}
	var seen string
	h := Middleware(m, nil, tokens)(func(c *echo.Context) error {
		seen = UserID(c)
		return c.String(200, "ok")
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	require.NoError(t, h(e.NewContext(req, httptest.NewRecorder())))
	require.Equal(t, "u-pat", seen)
	require.Equal(t, []string{"tok-1"}, tokens.touched)
}

func TestMiddlewareRejectsExpiredPAT(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	secret, err := GeneratePAT()
	require.NoError(t, err)
	tokens := &testTokenStore{
		getByHash: func(ctx context.Context, hash string) (store.AccessToken, error) {
			return store.AccessToken{
				ID:     "tok-1",
				UserID: "u-pat",
				ExpiresAt: sql.NullTime{
					Time:  time.Now().Add(-time.Hour),
					Valid: true,
				},
			}, nil
		},
	}
	h := Middleware(m, nil, tokens)(func(c *echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	err = h(e.NewContext(req, httptest.NewRecorder()))
	require.Error(t, err)
	httpErr, ok := err.(*echo.HTTPError)
	require.True(t, ok)
	require.Equal(t, http.StatusUnauthorized, httpErr.Code)
}

func TestMiddlewareRejectsUnknownPAT(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	secret, err := GeneratePAT()
	require.NoError(t, err)
	tokens := &testTokenStore{
		getByHash: func(ctx context.Context, hash string) (store.AccessToken, error) {
			return store.AccessToken{}, errors.New("not found")
		},
	}
	h := Middleware(m, nil, tokens)(func(c *echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	err = h(e.NewContext(req, httptest.NewRecorder()))
	require.Error(t, err)
}
