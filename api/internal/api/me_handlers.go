package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
)

// The signed-in account. Until now nothing exposed it, so neither client could
// say who was logged in — the phone stored only a server URL and two opaque
// tokens.
func (s *Server) meRoutes(g *echo.Group) {
	g.GET("/me", s.handleMe)
	g.PUT("/me/password", s.handleChangePassword)
}

type meDTO struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	IsAdmin   bool      `json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
	// Reported so a client can show "2FA: off" without guessing. The column has
	// existed since the first users migration and is still never written.
	TotpEnabled bool `json:"totp_enabled"`
}

func (s *Server) handleMe(c echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	u, err := s.deps.Auth.Me(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "no such user", nil)
	}
	return c.JSON(http.StatusOK, meDTO{
		ID:          u.ID,
		Email:       u.Email,
		IsAdmin:     u.IsAdmin == 1,
		CreatedAt:   u.CreatedAt,
		TotpEnabled: u.TotpSecret.Valid && u.TotpSecret.String != "",
	})
}

type changePasswordReq struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (s *Server) handleChangePassword(c echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in changePasswordReq
	if err := c.Bind(&in); err != nil || in.CurrentPassword == "" || in.NewPassword == "" {
		return Fail(http.StatusBadRequest, "bad_request",
			"current_password and new_password required", nil)
	}
	toks, err := s.deps.Auth.ChangePassword(
		c.Request().Context(), auth.UserID(c), in.CurrentPassword, in.NewPassword)
	if errors.Is(err, auth.ErrPasswordTooShort) {
		return Fail(http.StatusBadRequest, "bad_request",
			"password must be at least "+strconv.Itoa(auth.MinPasswordLen)+" characters", nil)
	}
	if errors.Is(err, auth.ErrInvalidCredentials) {
		return Fail(http.StatusForbidden, "forbidden", "current password is incorrect", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not change password", nil)
	}
	// Fresh pair for this caller: the new hash invalidates every token minted
	// against the old one, including the ones this request arrived with.
	return c.JSON(http.StatusOK, toks)
}
