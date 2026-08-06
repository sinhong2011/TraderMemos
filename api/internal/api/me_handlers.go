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
	g.POST("/me/totp/start", s.handleTotpStart)
	g.POST("/me/totp/confirm", s.handleTotpConfirm)
	g.POST("/me/totp/disable", s.handleTotpDisable)
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

// Enrolment is two calls: start mints a candidate secret, confirm proves the
// user can read a code from it before anything is stored. Nothing is written
// in between — see auth.StartTotp for why it is stateless.
func (s *Server) handleTotpStart(c echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	secret, url, err := s.deps.Auth.StartTotp(c.Request().Context(), auth.UserID(c))
	if errors.Is(err, auth.ErrTotpAlreadyOn) {
		return Fail(http.StatusConflict, "conflict", "an authenticator is already set up", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not start setup", nil)
	}
	// The secret is returned for manual entry when a QR code cannot be scanned
	// — the phone showing this screen is often the phone holding the app.
	return c.JSON(http.StatusOK, map[string]any{"secret": secret, "otpauth_url": url})
}

type totpConfirmReq struct {
	Secret string `json:"secret"`
	Code   string `json:"code"`
}

func (s *Server) handleTotpConfirm(c echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in totpConfirmReq
	if err := c.Bind(&in); err != nil || in.Secret == "" || in.Code == "" {
		return Fail(http.StatusBadRequest, "bad_request", "secret and code required", nil)
	}
	err := s.deps.Auth.ConfirmTotp(c.Request().Context(), auth.UserID(c), in.Secret, in.Code)
	if errors.Is(err, auth.ErrTotpAlreadyOn) {
		return Fail(http.StatusConflict, "conflict", "an authenticator is already set up", nil)
	}
	if errors.Is(err, auth.ErrTotpInvalid) {
		return Fail(http.StatusBadRequest, "totp_invalid", "that code is not valid", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not enable", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

type totpDisableReq struct {
	Password string `json:"password"`
	Code     string `json:"code"`
}

// POST rather than DELETE: turning a factor off carries a body (password and
// code), and DELETE with a body is poorly supported across proxies and clients.
func (s *Server) handleTotpDisable(c echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in totpDisableReq
	if err := c.Bind(&in); err != nil || in.Password == "" || in.Code == "" {
		return Fail(http.StatusBadRequest, "bad_request", "password and code required", nil)
	}
	err := s.deps.Auth.DisableTotp(c.Request().Context(), auth.UserID(c), in.Password, in.Code)
	if errors.Is(err, auth.ErrTotpNotEnrolled) {
		return Fail(http.StatusConflict, "conflict", "no authenticator is set up", nil)
	}
	if errors.Is(err, auth.ErrTotpInvalid) {
		return Fail(http.StatusBadRequest, "totp_invalid", "that code is not valid", nil)
	}
	if errors.Is(err, auth.ErrInvalidCredentials) {
		return Fail(http.StatusForbidden, "forbidden", "password is incorrect", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not disable", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
