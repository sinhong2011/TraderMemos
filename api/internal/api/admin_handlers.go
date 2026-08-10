package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

// Multi-user administration. `users.is_admin` has existed since migration
// 000029 and was written once, for the first user, then never read for
// anything but display — these are the first routes that enforce it.
func (s *Server) adminRoutes(g *echo.Group) {
	admin := g.Group("/admin", s.requireAdmin)
	admin.GET("/users", s.handleListUsers)
	admin.POST("/users", s.handleCreateUser)
	admin.PATCH("/users/:id", s.handleSetUserAdmin)
	admin.POST("/users/:id/password", s.handleAdminResetPassword)
	admin.DELETE("/users/:id", s.handleDeleteUser)
}

// requireAdmin re-reads the user rather than trusting a claim in the token:
// a demotion has to take effect for tokens already in circulation.
func (s *Server) requireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		if s.deps.Store == nil {
			return Fail(http.StatusServiceUnavailable, "unavailable", "store not configured", nil)
		}
		u, err := s.deps.Store.GetUserByID(c.Request().Context(), auth.UserID(c))
		if err != nil {
			return Fail(http.StatusUnauthorized, "unauthorized", "no such user", nil)
		}
		if u.IsAdmin != 1 {
			return Fail(http.StatusForbidden, "forbidden", "owner access required", nil)
		}
		return next(c)
	}
}

type adminUserDTO struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	IsAdmin     bool      `json:"is_admin"`
	CreatedAt   time.Time `json:"created_at"`
	TotpEnabled bool      `json:"totp_enabled"`
}

func adminUserToDTO(u store.User) adminUserDTO {
	return adminUserDTO{
		ID:          u.ID,
		Email:       u.Email,
		IsAdmin:     u.IsAdmin == 1,
		CreatedAt:   u.CreatedAt,
		TotpEnabled: u.TotpSecret.Valid && u.TotpSecret.String != "",
	}
}

func (s *Server) handleListUsers(c *echo.Context) error {
	rows, err := s.deps.Store.ListUsers(c.Request().Context())
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list users", nil)
	}
	out := make([]adminUserDTO, 0, len(rows))
	for _, u := range rows {
		out = append(out, adminUserToDTO(u))
	}
	return c.JSON(http.StatusOK, out)
}

type adminCreateUserReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"is_admin"`
}

// Creating a user here deliberately bypasses the registration gate. On a
// self-hosted box TM_ALLOW_REGISTRATION defaults to false, which is the right
// default for a public port — the owner inviting someone is a different act
// from letting the internet sign itself up.
func (s *Server) handleCreateUser(c *echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in adminCreateUserReq
	if err := c.Bind(&in); err != nil || in.Email == "" || in.Password == "" {
		return Fail(http.StatusBadRequest, "bad_request", "email and password required", nil)
	}
	u, err := s.deps.Auth.CreateUserAsAdmin(c.Request().Context(), in.Email, in.Password, in.IsAdmin)
	if errors.Is(err, auth.ErrPasswordTooShort) {
		return Fail(http.StatusBadRequest, "bad_request",
			"password must be at least "+strconv.Itoa(auth.MinPasswordLen)+" characters", nil)
	}
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not create user", nil)
	}
	return c.JSON(http.StatusCreated, adminUserToDTO(u))
}

type adminSetAdminReq struct {
	IsAdmin *bool `json:"is_admin"`
}

func (s *Server) handleSetUserAdmin(c *echo.Context) error {
	var in adminSetAdminReq
	if err := c.Bind(&in); err != nil || in.IsAdmin == nil {
		return Fail(http.StatusBadRequest, "bad_request", "is_admin required", nil)
	}
	ctx := c.Request().Context()
	target := c.Param("id")

	// Demoting the last owner leaves nobody able to administer the server, and
	// the only way back is shell access. Refuse rather than strand them.
	if !*in.IsAdmin {
		if err := s.guardLastAdmin(ctx, target); err != nil {
			return err
		}
	}
	flag := int64(0)
	if *in.IsAdmin {
		flag = 1
	}
	u, err := s.deps.Store.SetUserAdmin(ctx, store.SetUserAdminParams{IsAdmin: flag, ID: target})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "no such user", nil)
	}
	return c.JSON(http.StatusOK, adminUserToDTO(u))
}

type adminResetPasswordReq struct {
	NewPassword string `json:"new_password"`
}

// The owner's answer to "I'm locked out" — no current password, because the
// point is that the user does not have it. It still invalidates their refresh
// tokens, since the hash changes (see the `pv` claim in auth/jwt.go).
func (s *Server) handleAdminResetPassword(c *echo.Context) error {
	if s.deps.Auth == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "auth not configured", nil)
	}
	var in adminResetPasswordReq
	if err := c.Bind(&in); err != nil || in.NewPassword == "" {
		return Fail(http.StatusBadRequest, "bad_request", "new_password required", nil)
	}
	err := s.deps.Auth.ResetPasswordAsAdmin(c.Request().Context(), c.Param("id"), in.NewPassword)
	if errors.Is(err, auth.ErrPasswordTooShort) {
		return Fail(http.StatusBadRequest, "bad_request",
			"password must be at least "+strconv.Itoa(auth.MinPasswordLen)+" characters", nil)
	}
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "no such user", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

// Deleting a user cascades every account, trade, note and attachment they own
// (ON DELETE CASCADE throughout). There is no undo and no soft delete — the
// client is responsible for making that plain before it calls this.
func (s *Server) handleDeleteUser(c *echo.Context) error {
	ctx := c.Request().Context()
	target := c.Param("id")
	if target == auth.UserID(c) {
		return Fail(http.StatusBadRequest, "bad_request",
			"you cannot delete your own account here", nil)
	}
	if err := s.guardLastAdmin(ctx, target); err != nil {
		return err
	}
	n, err := s.deps.Store.DeleteUser(ctx, target)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete user", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "no such user", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

// guardLastAdmin refuses an action that would remove the final owner. Checked
// against the *target*: removing a non-admin can never strand the server, so
// only a demotion or deletion of the last admin is blocked.
func (s *Server) guardLastAdmin(ctx context.Context, target string) error {
	u, err := s.deps.Store.GetUserByID(ctx, target)
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "no such user", nil)
	}
	if u.IsAdmin != 1 {
		return nil
	}
	admins, err := s.deps.Store.CountAdmins(ctx)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not count owners", nil)
	}
	if admins <= 1 {
		return Fail(http.StatusConflict, "conflict",
			"this is the only owner — promote someone else first", nil)
	}
	return nil
}
