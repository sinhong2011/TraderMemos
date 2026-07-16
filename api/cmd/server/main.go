package main

import (
	"log"
	"os"
	"path/filepath"

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
)

func main() {
	cfg, err := config.Load()
	if err != nil {
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

	q := store.New(conn)
	jwt := auth.NewJWT(cfg.JWTSecret)
	attachDir := filepath.Join(filepath.Dir(cfg.DBPath), "attachments")
	var marketSvc *marketdata.Service
	if cfg.MarketDataEnabled {
		provider := marketdata.NewProvider(cfg.MarketDataProvider, cfg.MarketDataAPIKey)
		marketSvc = marketdata.NewService(q, provider)
		logger.Info("market data enabled", "provider", provider.Name())
	}
	var ocrSvc *ocr.Service
	if cfg.OCREnabled {
		provider, err := ocr.NewProvider(cfg.OCRProvider, cfg.OCRLang)
		if err != nil {
			logger.Warn("ocr disabled", "err", err)
		} else {
			ocrSvc = ocr.NewService(provider)
			logger.Info("ocr enabled", "provider", provider.Name(), "lang", cfg.OCRLang)
		}
	}
	s := api.New(api.Deps{
		JWTSecret:      cfg.JWTSecret,
		JWT:            jwt,
		Auth:           auth.NewService(q, jwt),
		Store:          q,
		Trades:         trades.NewService(q),
		Logger:         logger,
		Storage:        storage.NewLocalDisk(attachDir),
		AttachMaxBytes: cfg.AttachMaxBytes,
		ImportMaxBytes: cfg.ImportMaxBytes,
		OCRMaxBytes:    cfg.OCRMaxBytes,
		Market:         marketSvc,
		OCR:            ocrSvc,
	})
	logger.Info("tradermemos api listening", "port", cfg.HTTPPort, "db", cfg.DBPath, "log_level", cfg.LogLevel)
	log.Fatal(s.Echo.Start(":" + cfg.HTTPPort))
}
