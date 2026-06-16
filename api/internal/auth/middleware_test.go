package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	h := Middleware(m)(func(c echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	require.Error(t, h(e.NewContext(req, rec)))
}

func TestMiddlewareInjectsUserID(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	tok, _ := m.Mint("u-1", 60_000_000_000) // 1 minute in ns
	var seen string
	h := Middleware(m)(func(c echo.Context) error {
		seen = UserID(c)
		return c.String(200, "ok")
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	require.NoError(t, h(e.NewContext(req, httptest.NewRecorder())))
	require.Equal(t, "u-1", seen)
}
