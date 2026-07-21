package config

import (
	"strings"

	"github.com/knadh/koanf/providers/confmap"
	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/v2"
)

type Config struct {
	HTTPPort           string
	DBPath             string
	JWTSecret          string
	DefaultCurrency    string
	LogLevel           string
	AttachMaxBytes     int64
	ImportMaxBytes     int64
	MarketDataProvider string
	MarketDataAPIKey   string
	MarketDataEnabled  bool
	OCREnabled         bool
	OCRMaxBytes        int64
	OCRVisionBaseURL   string
	OCRVisionAPIKey    string
	OCRVisionModel     string
	OCRVisionTimeoutSec int
	CoachEnabled       bool
	CoachBaseURL       string
	CoachAPIKey        string
	CoachModel         string
}

func Load() (Config, error) {
	k := koanf.New(".")
	_ = k.Load(confmap.Provider(map[string]interface{}{
		"http_port":            "8080",
		"db_path":              "data/tradermemos.db",
		"jwt_secret":           "dev-insecure-change-me",
		"default_currency":     "USD",
		"log_level":            "info",
		"attach_max_bytes":     int64(10 << 20),
		"import_max_bytes":     int64(10 << 20),
		"market_data_provider": "yahoo",
		"market_data_enabled":  true,
		"ocr_enabled":           false,
		"ocr_max_bytes":         int64(10 << 20),
		"ocr_vision_base_url":   "https://api.openai.com/v1",
		"ocr_vision_api_key":    "",
		"ocr_vision_model":      "gpt-4o-mini",
		"ocr_vision_timeout_sec": 90,
		"coach_enabled":          false,
		"coach_base_url":         "https://api.openai.com/v1",
		"coach_api_key":          "",
		"coach_model":            "gpt-4o-mini",
	}, "."), nil)

	// TM_HTTP_PORT -> http_port
	_ = k.Load(env.Provider("TM_", ".", func(s string) string {
		return strings.ReplaceAll(strings.ToLower(strings.TrimPrefix(s, "TM_")), "__", ".")
	}), nil)

	return Config{
		HTTPPort:           k.String("http_port"),
		DBPath:             k.String("db_path"),
		JWTSecret:          k.String("jwt_secret"),
		DefaultCurrency:    k.String("default_currency"),
		LogLevel:           k.String("log_level"),
		AttachMaxBytes:     k.Int64("attach_max_bytes"),
		ImportMaxBytes:     k.Int64("import_max_bytes"),
		MarketDataProvider: k.String("market_data_provider"),
		MarketDataAPIKey:   k.String("market_data_api_key"),
		MarketDataEnabled:  k.Bool("market_data_enabled"),
		OCREnabled:          k.Bool("ocr_enabled"),
		OCRMaxBytes:         k.Int64("ocr_max_bytes"),
		OCRVisionBaseURL:    k.String("ocr_vision_base_url"),
		OCRVisionAPIKey:     k.String("ocr_vision_api_key"),
		OCRVisionModel:      k.String("ocr_vision_model"),
		OCRVisionTimeoutSec: k.Int("ocr_vision_timeout_sec"),
		CoachEnabled:        k.Bool("coach_enabled"),
		CoachBaseURL:        k.String("coach_base_url"),
		CoachAPIKey:         k.String("coach_api_key"),
		CoachModel:          k.String("coach_model"),
	}, nil
}
