package api

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/ocr"
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
	Logger         *slog.Logger
	Storage        storage.Storage
	AttachMaxBytes int64
	ImportMaxBytes int64
	OCRMaxBytes    int64
	Market         *marketdata.Service
	OCR            *ocr.Service
}

type Server struct {
	Echo   *echo.Echo
	deps   Deps
	logger *slog.Logger
}

func New(deps Deps) *Server {
	lg := deps.Logger
	if lg == nil {
		lg = slog.Default()
	}

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errorHandler
	e.Use(middleware.RequestID())
	e.Use(requestLogger(lg))
	e.Use(middleware.Recover())
	// Reject oversized request bodies at read time (before multipart parse).
	// Sized to the largest configured upload cap; a 16KiB floor covers JSON.
	if lim := bodyLimit(deps); lim > 0 {
		e.Use(middleware.BodyLimit(strconv.FormatInt(lim, 10) + "B"))
	}

	s := &Server{Echo: e, deps: deps, logger: lg}
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	s.routes()
	return s
}

// bodyLimit returns the larger of the configured upload caps (0 = no limit).
func bodyLimit(deps Deps) int64 {
	lim := deps.AttachMaxBytes
	if deps.ImportMaxBytes > lim {
		lim = deps.ImportMaxBytes
	}
	if deps.OCRMaxBytes > lim {
		lim = deps.OCRMaxBytes
	}
	return lim
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
	s.settingsRoutes(protected)
	s.noteRoutes(protected)
	s.checklistRoutes(protected)
	s.marketRoutes(protected)
	s.ocrRoutes(protected)
}
