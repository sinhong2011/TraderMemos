package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// Sent on the second leg of a two-step sign-in, after a `totp_required`.
	TotpCode string `json:"totp_code"`
}

func (s *Server) authRoutes(g *echo.Group) {
	g.POST("/auth/register", s.handleRegister)
	g.POST("/auth/login", s.handleLogin)
	g.POST("/auth/refresh", s.handleRefresh)
}

func (s *Server) handleSetupStatus(c *echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	needs, err := s.deps.Auth.NeedsSetup(c.Request().Context())
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not read setup status", nil)
	}
	open, err := s.deps.Auth.RegistrationOpen(c.Request().Context())
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not read registration status", nil)
	}
	n, err := s.deps.Auth.CountUsers(c.Request().Context())
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not count users", nil)
	}
	return c.JSON(http.StatusOK, map[string]any{
		"needs_setup":         needs,
		"registration_open":   open,
		"user_count":          n,
		"min_password_length": auth.MinPasswordLen,
	})
}

type setupReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Account  *struct {
		Name            string  `json:"name"`
		Broker          string  `json:"broker"`
		AccountType     string  `json:"account_type"`
		BaseCurrency    string  `json:"base_currency"`
		StartingBalance float64 `json:"starting_balance"`
	} `json:"account"`
}

func (s *Server) handleSetupComplete(c *echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in setupReq
	if err := c.Bind(&in); err != nil || in.Email == "" || in.Password == "" {
		return Fail(http.StatusBadRequest, "bad_request", "email and password required", nil)
	}
	u, toks, err := s.deps.Auth.CompleteSetup(c.Request().Context(), in.Email, in.Password)
	if errors.Is(err, auth.ErrSetupComplete) {
		return Fail(http.StatusConflict, "conflict", "setup already complete", nil)
	}
	if errors.Is(err, auth.ErrPasswordTooShort) {
		return Fail(http.StatusBadRequest, "bad_request",
			"password must be at least "+strconv.Itoa(auth.MinPasswordLen)+" characters", nil)
	}
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not complete setup", nil)
	}

	var account any
	if in.Account != nil && in.Account.Name != "" && s.deps.Store != nil {
		accType := in.Account.AccountType
		if accType == "" {
			accType = "cash"
		}
		cur := in.Account.BaseCurrency
		if cur == "" {
			cur = "USD"
		}
		acc, aerr := s.deps.Store.CreateAccount(c.Request().Context(), store.CreateAccountParams{
			ID:              uuid.NewString(),
			UserID:          u.ID,
			Name:            in.Account.Name,
			Broker:          in.Account.Broker,
			AccountType:     accType,
			BaseCurrency:    cur,
			StartingBalance: in.Account.StartingBalance,
		})
		if aerr != nil {
			return Fail(http.StatusInternalServerError, "internal", "owner created but account failed", nil)
		}
		if err := s.ensureOpeningDeposit(c.Request().Context(), s.deps.Store, u.ID, acc); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "owner created but opening deposit failed", nil)
		}
		account = acc
	}

	return c.JSON(http.StatusCreated, map[string]any{
		"id":            u.ID,
		"email":         u.Email,
		"is_admin":      u.IsAdmin == 1,
		"access_token":  toks.Access,
		"refresh_token": toks.Refresh,
		"account":       account,
	})
}

func (s *Server) handleRegister(c *echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil || in.Email == "" || in.Password == "" {
		return Fail(http.StatusBadRequest, "bad_request", "email and password required", nil)
	}
	u, err := s.deps.Auth.Register(c.Request().Context(), in.Email, in.Password)
	if errors.Is(err, auth.ErrRegistrationClosed) {
		return Fail(http.StatusForbidden, "forbidden", "registration is closed; use setup for the first user or ask the owner to enable TM_ALLOW_REGISTRATION", nil)
	}
	if errors.Is(err, auth.ErrPasswordTooShort) {
		return Fail(http.StatusBadRequest, "bad_request",
			"password must be at least "+strconv.Itoa(auth.MinPasswordLen)+" characters", nil)
	}
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not register", nil)
	}
	return c.JSON(http.StatusCreated, map[string]any{"id": u.ID, "email": u.Email, "is_admin": u.IsAdmin == 1})
}

func (s *Server) handleLogin(c *echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, _, err := s.deps.Auth.Login(c.Request().Context(), in.Email, in.Password, in.TotpCode)
	// A distinct code, not a generic 401: the client has to know to ask for a
	// code rather than tell the user their password was wrong. Only reachable
	// once the password has already checked out.
	if errors.Is(err, auth.ErrTotpRequired) {
		return Fail(http.StatusUnauthorized, "totp_required", "authenticator code required", nil)
	}
	if errors.Is(err, auth.ErrTotpInvalid) {
		return Fail(http.StatusUnauthorized, "totp_invalid", "that code is not valid", nil)
	}
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
	}
	return c.JSON(http.StatusOK, toks)
}

func (s *Server) handleRefresh(c *echo.Context) error {
	var in struct {
		Refresh string `json:"refresh_token"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, err := s.deps.Auth.Refresh(c.Request().Context(), in.Refresh)
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid refresh token", nil)
	}
	return c.JSON(http.StatusOK, toks)
}
