package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/econdata"
	"github.com/tradermemos/api/internal/flexsync"
	"github.com/tradermemos/api/internal/jobs"
	"github.com/tradermemos/api/internal/logging"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
	"github.com/tradermemos/api/internal/version"

	// Embed the IANA tz database so `tz` query params and the ET session clock
	// resolve inside minimal containers without a tzdata package.
	_ "time/tzdata"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err := cfg.ValidateAuth(); err != nil {
		log.Fatal(err)
	}
	if cfg.Driver == db.DriverSQLite && cfg.DBPath != "" {
		if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755); err != nil {
			log.Fatal(err)
		}
	}
	conn, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Migrate(conn, cfg.Driver); err != nil {
		log.Fatal(err)
	}
	logger := logging.New(cfg.LogLevel)
	logger.Info("starting tradermemos api",
		"version", version.Version, "commit", version.Commit,
		"build_time", version.BuildTime, "go", runtime.Version())
	if config.IsInsecureJWTSecret(cfg.JWTSecret) {
		logger.Warn("TM_JWT_SECRET is insecure — acceptable only for local/dev; set openssl rand -hex 32 for production")
	}
	logger.Info("auth policy", "detail", cfg.AuthSummary())

	q := store.NewForDriver(conn, cfg.Driver)
	if err := store.SeedInstrumentSpecs(context.Background(), q); err != nil {
		logger.Warn("could not seed instrument specs", "err", err)
	}
	jwt := auth.NewJWT(cfg.JWTSecret)
	attachDir := cfg.AttachDir
	if attachDir == "" {
		if cfg.DBPath != "" {
			attachDir = filepath.Join(filepath.Dir(cfg.DBPath), "attachments")
		} else {
			attachDir = "data/attachments"
		}
	}
	var marketSvc *marketdata.Service
	if cfg.MarketDataEnabled {
		provider := marketdata.NewProvider(cfg.MarketDataProvider, cfg.MarketDataAPIKey)
		marketSvc = marketdata.NewService(q, provider)
		logger.Info("market data enabled", "provider", provider.Name())
	}
	var econSvc *econdata.Service
	if cfg.EconCalendarEnabled {
		econProvider := econdata.NewFairEconomyProvider(cfg.EconCalendarFeedURL)
		econSvc = econdata.NewService(q, econProvider)
		if cfg.EconCalendarRefreshMin > 0 {
			econSvc.TTL = time.Duration(cfg.EconCalendarRefreshMin) * time.Minute
		}
		logger.Info("economic calendar enabled", "provider", econProvider.Name())
	}
	var ocrSvc *ocr.Service
	defaults := ocr.VisionConfig{
		Enabled: cfg.OCREnabled,
		BaseURL: cfg.OCRVisionBaseURL,
		APIKey:  cfg.OCRVisionAPIKey,
		Model:   cfg.OCRVisionModel,
	}
	if cfg.OCRVisionTimeoutSec > 0 {
		defaults.Timeout = time.Duration(cfg.OCRVisionTimeoutSec) * time.Second
	}
	ocrSvc = ocr.NewService(defaults, func(ctx context.Context) (ocr.VisionConfig, bool, error) {
		return api.LoadOcrVisionOverlay(ctx, q)
	})
	if defaults.Ready() {
		logger.Info("ocr vision env defaults ready", "model", cfg.OCRVisionModel, "base_url", cfg.OCRVisionBaseURL)
	} else if cfg.OCREnabled {
		logger.Warn("ocr env incomplete — configure in Settings → AI or set TM_OCR_VISION_*")
	}
	coachDefaults := ocr.VisionConfig{
		Enabled: cfg.CoachEnabled,
		BaseURL: cfg.CoachBaseURL,
		APIKey:  cfg.CoachAPIKey,
		Model:   cfg.CoachModel,
	}
	flexClient := &flexsync.Client{}
	alertsSvc := alerts.NewService(q, logger, cfg.AlertsAllowPrivateWebhooks)
	tradesSvc := trades.NewService(q)
	tradesSvc.AfterRegroup = func(userID, _ string) { alertsSvc.TradeWritten(userID) }
	s := api.New(api.Deps{
		JWTSecret:         cfg.JWTSecret,
		JWT:               jwt,
		Auth:              auth.NewService(q, jwt, cfg.AllowRegistration),
		Store:             q,
		Trades:            tradesSvc,
		Alerts:            alertsSvc,
		Logger:            logger,
		Storage:           storage.NewLocalDisk(attachDir),
		AttachMaxBytes:    cfg.AttachMaxBytes,
		ImportMaxBytes:    cfg.ImportMaxBytes,
		OCRMaxBytes:       cfg.OCRMaxBytes,
		Market:            marketSvc,
		Econ:              econSvc,
		OCR:               ocrSvc,
		CoachDefaults:     coachDefaults,
		FlexClient:        flexClient,
		CORSOrigins:       cfg.CORSOrigins,
		AuthRateLimit:     2, // 2 req/s per IP on auth + setup + public share
		ShareLinksEnabled: cfg.ShareLinksEnabled,
		PublicWebURL:      cfg.PublicWebURL,
		Driver:            cfg.Driver,
		Features: map[string]bool{
			"market_data":     cfg.MarketDataEnabled,
			"econ_calendar":   cfg.EconCalendarEnabled,
			"ocr":             cfg.OCREnabled,
			"coach":           cfg.CoachEnabled,
			"background_jobs": cfg.JobsEnabled,
			"share_links":     cfg.ShareLinksEnabled,
		},
	})
	if len(cfg.CORSOrigins) > 0 {
		logger.Info("cors enabled", "origins", cfg.CORSOrigins)
	}
	if cfg.JobsEnabled {
		runner := jobs.NewRunner(logger)
		if marketSvc != nil && cfg.JobExcursionIntervalMin > 0 && cfg.JobExcursionLimit > 0 {
			runner.Register(jobs.NewExcursionBackfill(
				q, marketSvc,
				time.Duration(cfg.JobExcursionIntervalMin)*time.Minute,
				cfg.JobExcursionLimit, time.Second, logger,
			))
		}
		if cfg.JobFlexSyncIntervalMin > 0 {
			runner.Register(jobs.NewFlexSync(
				q, flexClient,
				time.Duration(cfg.JobFlexSyncIntervalMin)*time.Minute,
				logger,
			))
		}
		if cfg.JobAlertsIntervalMin > 0 {
			runner.Register(jobs.NewAlertScan(
				q, alertsSvc,
				time.Duration(cfg.JobAlertsIntervalMin)*time.Minute,
				logger,
			))
		}
		if names := runner.Names(); len(names) > 0 {
			runner.Start(context.Background())
			logger.Info("background jobs started", "jobs", names)
		}
	}
	logger.Info("tradermemos api listening", "port", cfg.HTTPPort, "version", version.Version, "db", db.RedactDatabaseURL(cfg.DatabaseURL), "log_level", cfg.LogLevel)
	// Start returns nil once SIGINT/SIGTERM has drained in-flight requests.
	if err := s.Start(":" + cfg.HTTPPort); err != nil {
		logger.Error("tradermemos api stopped", "err", err)
		os.Exit(1)
	}
	logger.Info("tradermemos api stopped")
}
