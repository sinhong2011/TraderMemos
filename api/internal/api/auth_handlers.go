package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) authRoutes(g *echo.Group) {
	g.POST("/auth/register", s.handleRegister)
	g.POST("/auth/login", s.handleLogin)
	g.POST("/auth/refresh", s.handleRefresh)
}

func (s *Server) handleRegister(c echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil || in.Email == "" || in.Password == "" {
		return Fail(http.StatusBadRequest, "bad_request", "email and password required", nil)
	}
	u, err := s.deps.Auth.Register(c.Request().Context(), in.Email, in.Password)
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not register", nil)
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": u.ID, "email": u.Email})
}

func (s *Server) handleLogin(c echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, _, err := s.deps.Auth.Login(c.Request().Context(), in.Email, in.Password)
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
	}
	return c.JSON(http.StatusOK, toks)
}

func (s *Server) handleRefresh(c echo.Context) error {
	var in struct {
		Refresh string `json:"refresh_token"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, err := s.deps.Auth.Refresh(in.Refresh)
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid refresh token", nil)
	}
	return c.JSON(http.StatusOK, toks)
}
