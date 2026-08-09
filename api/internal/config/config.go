package config

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/knadh/koanf/providers/confmap"
	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/v2"
	"github.com/tradermemos/api/internal/db"
)

const (
	DefaultInsecureJWTSecret = "dev-insecure-change-me"
	MinJWTSecretLen          = 32
)

type Config struct {
	HTTPPort string
	// DatabaseURL is the unified DB connection string (TM_DATABASE_URL).
	// Examples: sqlite:data/tradermemos.db, sqlite:///data/tradermemos.db,
	// postgres://user:pass@host:5432/db?sslmode=require
	DatabaseURL string
	// Driver is "sqlite" or "postgres" after resolveDatabase.
	Driver string
	// DBPath is the SQLite filesystem path when Driver is sqlite.
	// Still accepted via legacy TM_DB_PATH (converted to a sqlite: URL).
	DBPath            string
	JWTSecret         string
	AllowInsecureJWT  bool
	AllowRegistration bool
	DefaultCurrency   string
	LogLevel          string
	AttachMaxBytes    int64
	// AttachDir overrides the default attachments directory.
	// Empty = <dir(DBPath)>/attachments for sqlite; for postgres set explicitly
	// (defaults to data/attachments when DBPath is empty).
	AttachDir           string
	ImportMaxBytes      int64
	MarketDataProvider  string
	MarketDataAPIKey    string
	MarketDataEnabled   bool
	EconCalendarEnabled bool
	// EconCalendarFeedURL overrides the FairEconomy (ForexFactory) feed URL.
	// Empty = the provider default.
	EconCalendarFeedURL string
	// EconCalendarRefreshMin is the cache TTL in minutes before a request
	// re-fetches the feed. The upstream rate limit is 2 downloads / 5 min.
	EconCalendarRefreshMin int
	OCREnabled             bool
	OCRMaxBytes            int64
	OCRVisionBaseURL       string
	OCRVisionAPIKey        string
	OCRVisionModel         string
	OCRVisionTimeoutSec    int
	CoachEnabled           bool
	CoachBaseURL           string
	CoachAPIKey            string
	CoachModel             string
	// ShareLinksEnabled turns on public share pages (TM_SHARE_LINKS_ENABLED).
	// Off by default: instances are self-hosted and a share link makes part of
	// the journal reachable without auth.
	ShareLinksEnabled bool
	// CORSOrigins is a comma-separated allowlist for browser frontends on
	// another origin (e.g. Vercel/Cloudflare Pages). Empty = CORS off
	// (same-origin Docker / reverse-proxy default).
	CORSOrigins []string
	// JobsEnabled is the global background-job kill switch (TM_JOBS_ENABLED).
	// Disable on extra replicas so scheduled work runs on one instance only.
	JobsEnabled bool
	// JobExcursionIntervalMin is minutes between MAE/MFE backfill passes;
	// 0 disables the job.
	JobExcursionIntervalMin int
	// JobExcursionLimit caps trades attempted per pass (each attempt may call
	// the market data provider); 0 disables the job.
	JobExcursionLimit int
	// JobFlexSyncIntervalMin is minutes between IBKR Flex sync passes;
	// 0 disables the scheduled job (manual sync stays available).
	JobFlexSyncIntervalMin int
}

func Load() (Config, error) {
	k := koanf.New(".")
	_ = k.Load(confmap.Provider(map[string]interface{}{
		"http_port":                  "8080",
		"database_url":               "",
		"db_path":                    "data/tradermemos.db",
		"jwt_secret":                 DefaultInsecureJWTSecret,
		"allow_insecure_jwt":         false,
		"allow_registration":         false,
		"default_currency":           "USD",
		"log_level":                  "info",
		"attach_max_bytes":           int64(10 << 20),
		"attach_dir":                 "",
		"import_max_bytes":           int64(10 << 20),
		"market_data_provider":       "yahoo",
		"market_data_enabled":        true,
		"econ_calendar_enabled":      true,
		"econ_calendar_feed_url":     "",
		"econ_calendar_refresh_min":  60,
		"ocr_enabled":                false,
		"ocr_max_bytes":              int64(10 << 20),
		"ocr_vision_base_url":        "https://api.openai.com/v1",
		"ocr_vision_api_key":         "",
		"ocr_vision_model":           "gpt-4o-mini",
		"ocr_vision_timeout_sec":     90,
		"coach_enabled":              false,
		"coach_base_url":             "https://api.openai.com/v1",
		"coach_api_key":              "",
		"coach_model":                "gpt-4o-mini",
		"share_links_enabled":        false,
		"cors_origins":               "",
		"jobs_enabled":               true,
		"job_excursion_interval_min": 360,
		"job_excursion_limit":        10,
		"job_flex_sync_interval_min": 360,
	}, "."), nil)

	// TM_HTTP_PORT -> http_port
	_ = k.Load(env.Provider("TM_", ".", func(s string) string {
		return strings.ReplaceAll(strings.ToLower(strings.TrimPrefix(s, "TM_")), "__", ".")
	}), nil)

	httpPort := k.String("http_port")
	// Railway / Heroku-style: honor PORT when TM_HTTP_PORT is unset.
	if _, set := os.LookupEnv("TM_HTTP_PORT"); !set {
		if p := os.Getenv("PORT"); p != "" {
			httpPort = p
		}
	}

	cfg := Config{
		HTTPPort:                httpPort,
		JWTSecret:               k.String("jwt_secret"),
		AllowInsecureJWT:        k.Bool("allow_insecure_jwt"),
		AllowRegistration:       k.Bool("allow_registration"),
		DefaultCurrency:         k.String("default_currency"),
		LogLevel:                k.String("log_level"),
		AttachMaxBytes:          k.Int64("attach_max_bytes"),
		AttachDir:               k.String("attach_dir"),
		ImportMaxBytes:          k.Int64("import_max_bytes"),
		MarketDataProvider:      k.String("market_data_provider"),
		MarketDataAPIKey:        k.String("market_data_api_key"),
		MarketDataEnabled:       k.Bool("market_data_enabled"),
		EconCalendarEnabled:     k.Bool("econ_calendar_enabled"),
		EconCalendarFeedURL:     k.String("econ_calendar_feed_url"),
		EconCalendarRefreshMin:  k.Int("econ_calendar_refresh_min"),
		OCREnabled:              k.Bool("ocr_enabled"),
		OCRMaxBytes:             k.Int64("ocr_max_bytes"),
		OCRVisionBaseURL:        k.String("ocr_vision_base_url"),
		OCRVisionAPIKey:         k.String("ocr_vision_api_key"),
		OCRVisionModel:          k.String("ocr_vision_model"),
		OCRVisionTimeoutSec:     k.Int("ocr_vision_timeout_sec"),
		CoachEnabled:            k.Bool("coach_enabled"),
		CoachBaseURL:            k.String("coach_base_url"),
		CoachAPIKey:             k.String("coach_api_key"),
		CoachModel:              k.String("coach_model"),
		ShareLinksEnabled:       k.Bool("share_links_enabled"),
		CORSOrigins:             SplitCSV(k.String("cors_origins")),
		JobsEnabled:             k.Bool("jobs_enabled"),
		JobExcursionIntervalMin: k.Int("job_excursion_interval_min"),
		JobExcursionLimit:       k.Int("job_excursion_limit"),
		JobFlexSyncIntervalMin:  k.Int("job_flex_sync_interval_min"),
	}
	if err := cfg.resolveDatabase(k.String("database_url"), k.String("db_path")); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// resolveDatabase prefers TM_DATABASE_URL; falls back to TM_DB_PATH / default path as sqlite:.
func (c *Config) resolveDatabase(databaseURL, dbPath string) error {
	raw := strings.TrimSpace(databaseURL)
	if raw == "" {
		if _, set := os.LookupEnv("TM_DATABASE_URL"); set {
			return errors.New("TM_DATABASE_URL is set but empty")
		}
		path := strings.TrimSpace(dbPath)
		if path == "" {
			path = "data/tradermemos.db"
		}
		raw = db.FormatSQLiteURL(path)
	}
	info, err := db.ParseURL(raw)
	if err != nil {
		return fmt.Errorf("TM_DATABASE_URL: %w", err)
	}
	c.DatabaseURL = info.URL
	c.Driver = info.Driver
	c.DBPath = info.SQLitePath
	return nil
}

// IsInsecureJWTSecret reports known throwaway defaults or undersized secrets.
func IsInsecureJWTSecret(secret string) bool {
	switch strings.TrimSpace(secret) {
	case "", DefaultInsecureJWTSecret, "change-me", "secret", "changeme":
		return true
	}
	return len(secret) < MinJWTSecretLen
}

// ValidateAuth enforces a strong JWT secret unless AllowInsecureJWT is set.
func (c Config) ValidateAuth() error {
	if !IsInsecureJWTSecret(c.JWTSecret) {
		return nil
	}
	if c.AllowInsecureJWT {
		return nil
	}
	return errors.New(
		"TM_JWT_SECRET is missing, too short (<32), or a known insecure default; " +
			"set a strong secret (openssl rand -hex 32) or TM_ALLOW_INSECURE_JWT=true for local only",
	)
}

// SplitCSV splits a comma-separated list, trimming spaces and dropping empties.
func SplitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// AuthSummary is a one-line log hint for registration policy.
func (c Config) AuthSummary() string {
	reg := "closed"
	if c.AllowRegistration {
		reg = "open"
	}
	return fmt.Sprintf("registration=%s", reg)
}
