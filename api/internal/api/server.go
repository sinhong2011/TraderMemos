package api

import (
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/econdata"
	"github.com/tradermemos/api/internal/flexsync"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
	"github.com/tradermemos/api/internal/version"
	"golang.org/x/time/rate"
)

// Deps holds the services handlers need. Populated in cmd/server.
type Deps struct {
	JWTSecret      string
	Auth           *auth.Service
	JWT            *auth.JWT
	Store          store.Querier
	Trades         *trades.Service
	Logger         *slog.Logger
	Storage        storage.Storage
	AttachMaxBytes int64
	ImportMaxBytes int64
	OCRMaxBytes    int64
	Market         *marketdata.Service
	Econ           *econdata.Service
	OCR            *ocr.Service
	CoachDefaults  ocr.VisionConfig
	// FlexClient talks to IBKR's Flex Web Service; nil disables manual sync.
	FlexClient *flexsync.Client
	// CORSOrigins enable browser cross-origin access when the SPA is hosted
	// separately (Vercel, Cloudflare Pages, etc.). Empty disables CORS.
	CORSOrigins []string
	// AuthRateLimit is requests/second per IP for auth + setup routes. 0 disables.
	AuthRateLimit rate.Limit
	// Driver is the database driver name ("sqlite" or "postgres") for /system/info.
	Driver string
	// Features reports which optional subsystems this deployment has enabled.
	Features map[string]bool
}

type Server struct {
	Echo      *echo.Echo
	deps      Deps
	logger    *slog.Logger
	startedAt time.Time
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
	e.Use(RequestLogger(lg))
	// Panics must land in the structured log, not echo's own gommon logger.
	e.Use(middleware.RecoverWithConfig(middleware.RecoverConfig{
		LogErrorFunc: func(c echo.Context, err error, stack []byte) error {
			lg.Error("panic recovered",
				"err", err.Error(),
				"stack", string(stack),
				"id", c.Response().Header().Get(echo.HeaderXRequestID),
			)
			return err
		},
	}))
	if len(deps.CORSOrigins) > 0 {
		origins := deps.CORSOrigins
		e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowOriginFunc: func(origin string) (bool, error) {
				return OriginAllowed(origin, origins), nil
			},
			AllowMethods: []string{
				http.MethodGet,
				http.MethodHead,
				http.MethodPut,
				http.MethodPatch,
				http.MethodPost,
				http.MethodDelete,
				http.MethodOptions,
			},
			AllowHeaders: []string{
				echo.HeaderOrigin,
				echo.HeaderContentType,
				echo.HeaderAccept,
				echo.HeaderAuthorization,
			},
			ExposeHeaders: []string{echo.HeaderXRequestID},
			MaxAge:        600,
		}))
	}
	// Reject oversized request bodies at read time (before multipart parse).
	// Sized to the largest configured upload cap; a 16KiB floor covers JSON.
	if lim := bodyLimit(deps); lim > 0 {
		e.Use(middleware.BodyLimit(strconv.FormatInt(lim, 10) + "B"))
	}

	s := &Server{Echo: e, deps: deps, logger: lg, startedAt: time.Now()}
	e.GET("/healthz", func(c echo.Context) error {
		payload := map[string]string{
			"status":  "ok",
			"version": version.Version,
			"go":      runtime.Version(),
		}
		if version.Commit != "" {
			payload["commit"] = version.Commit
		}
		return c.JSON(http.StatusOK, payload)
	})
	s.docsRoutes()
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

	// Lightweight install probe — not rate-limited (SPA polls on every unauth mount).
	v1.GET("/setup/status", s.handleSetupStatus)

	limited := v1.Group("")
	if lim := s.deps.AuthRateLimit; lim > 0 {
		burst := int(lim) * 3
		if burst < 5 {
			burst = 5
		}
		rlStore := middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      lim,
			Burst:     burst,
			ExpiresIn: 3 * time.Minute,
		})
		limited.Use(middleware.RateLimiter(rlStore))
	}
	s.authRoutes(limited)
	limited.POST("/setup", s.handleSetupComplete)

	protected := v1.Group("")
	if s.deps.JWT != nil {
		protected.Use(auth.Middleware(s.deps.JWT, s.deps.Store, s.deps.Store))
	}
	s.accountRoutes(protected)
	s.propRoutes(protected)
	s.flexSyncRoutes(protected)
	s.executionRoutes(protected)
	s.cashRoutes(protected)
	s.importRoutes(protected)
	s.exportRoutes(protected)
	s.tradeRoutes(protected)
	s.tagRoutes(protected)
	s.setupRoutes(protected)
	s.attachmentRoutes(protected)
	s.analyticsRoutes(protected)
	s.settingsRoutes(protected)
	s.noteRoutes(protected)
	s.checklistRoutes(protected)
	s.marketRoutes(protected)
	s.economicEventRoutes(protected)
	s.ocrRoutes(protected)
	s.accessTokenRoutes(protected)
	s.systemRoutes(protected)
}
