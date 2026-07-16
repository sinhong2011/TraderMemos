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
	OCRProvider        string
	OCRLang            string
	OCRMaxBytes        int64
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
		"ocr_enabled":          true,
		"ocr_provider":         "tesseract",
		"ocr_lang":             "eng",
		"ocr_max_bytes":        int64(10 << 20),
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
		OCREnabled:         k.Bool("ocr_enabled"),
		OCRProvider:        k.String("ocr_provider"),
		OCRLang:            k.String("ocr_lang"),
		OCRMaxBytes:        k.Int64("ocr_max_bytes"),
	}, nil
}
