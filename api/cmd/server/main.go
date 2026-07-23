package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/logging"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
	"golang.org/x/time/rate"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err := cfg.ValidateAuth(); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755); err != nil {
		log.Fatal(err)
	}
	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Migrate(conn); err != nil {
		log.Fatal(err)
	}
	logger := logging.New(cfg.LogLevel)
	if config.IsInsecureJWTSecret(cfg.JWTSecret) {
		logger.Warn("TM_JWT_SECRET is insecure — acceptable only for local/dev; set openssl rand -hex 32 for production")
	}
	logger.Info("auth policy", "detail", cfg.AuthSummary())

	q := store.New(conn)
	jwt := auth.NewJWT(cfg.JWTSecret)
	attachDir := cfg.AttachDir
	if attachDir == "" {
		attachDir = filepath.Join(filepath.Dir(cfg.DBPath), "attachments")
	}
	var marketSvc *marketdata.Service
	if cfg.MarketDataEnabled {
		provider := marketdata.NewProvider(cfg.MarketDataProvider, cfg.MarketDataAPIKey)
		marketSvc = marketdata.NewService(q, provider)
		logger.Info("market data enabled", "provider", provider.Name())
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
	s := api.New(api.Deps{
		JWTSecret:      cfg.JWTSecret,
		JWT:            jwt,
		Auth:           auth.NewService(q, jwt, cfg.AllowRegistration),
		Store:          q,
		Trades:         trades.NewService(q),
		Logger:         logger,
		Storage:        storage.NewLocalDisk(attachDir),
		AttachMaxBytes: cfg.AttachMaxBytes,
		ImportMaxBytes: cfg.ImportMaxBytes,
		OCRMaxBytes:    cfg.OCRMaxBytes,
		Market:         marketSvc,
		OCR:            ocrSvc,
		CoachDefaults:  coachDefaults,
		CORSOrigins:    cfg.CORSOrigins,
		AuthRateLimit:  rate.Limit(2), // 2 req/s per IP on auth + setup
		AllowDevAuth:   cfg.AllowInsecureJWT,
	})
	if cfg.AllowInsecureJWT {
		logger.Warn("dev auth enabled — POST /api/v1/auth/dev-ensure is available")
	}
	if len(cfg.CORSOrigins) > 0 {
		logger.Info("cors enabled", "origins", cfg.CORSOrigins)
	}
	logger.Info("tradermemos api listening", "port", cfg.HTTPPort, "db", cfg.DBPath, "log_level", cfg.LogLevel)
	log.Fatal(s.Echo.Start(":" + cfg.HTTPPort))
}
