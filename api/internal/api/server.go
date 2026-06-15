package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// Deps holds the services handlers need. Populated in cmd/server.
// Fields added as later tasks introduce services.
type Deps struct {
	JWTSecret string
}

type Server struct {
	Echo *echo.Echo
	deps Deps
}

func New(deps Deps) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errorHandler
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())

	s := &Server{Echo: e, deps: deps}
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	return s
}
