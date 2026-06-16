package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// Deps holds the services handlers need. Populated in cmd/server.
type Deps struct {
	JWTSecret      string
	Auth           *auth.Service
	JWT            *auth.JWT
	Store          *store.Queries
	Trades         *trades.Service
	Storage        storage.Storage
	AttachMaxBytes int64
	ImportMaxBytes int64
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
	s.routes()
	return s
}

func (s *Server) routes() {
	v1 := s.Echo.Group("/api/v1")
	s.authRoutes(v1)

	protected := v1.Group("")
	if s.deps.JWT != nil {
		protected.Use(auth.Middleware(s.deps.JWT))
	}
	s.accountRoutes(protected)
	s.executionRoutes(protected)
	s.cashRoutes(protected)
	s.importRoutes(protected)
	s.tradeRoutes(protected)
	s.tagRoutes(protected)
	s.setupRoutes(protected)
	s.attachmentRoutes(protected)
	s.analyticsRoutes(protected)
}
