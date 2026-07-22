package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "8080", cfg.HTTPPort)
	require.Equal(t, "data/tradermemos.db", cfg.DBPath)
	require.Equal(t, "USD", cfg.DefaultCurrency)
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("TM_HTTP_PORT", "9999")
	t.Setenv("TM_JWT_SECRET", "s3cr3t")
	t.Setenv("TM_CORS_ORIGINS", "https://app.example.com, http://localhost:5173")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "9999", cfg.HTTPPort)
	require.Equal(t, "s3cr3t", cfg.JWTSecret)
	require.Equal(t, []string{"https://app.example.com", "http://localhost:5173"}, cfg.CORSOrigins)
}

func TestLoadPortFallback(t *testing.T) {
	t.Setenv("PORT", "3456")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "3456", cfg.HTTPPort)
}

func TestLoadTMHTTPPortWinsOverPORT(t *testing.T) {
	t.Setenv("PORT", "1111")
	t.Setenv("TM_HTTP_PORT", "9999")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "9999", cfg.HTTPPort)
}

func TestSplitCSV(t *testing.T) {
	require.Nil(t, SplitCSV(""))
	require.Nil(t, SplitCSV("  , , "))
	require.Equal(t, []string{"https://a.test"}, SplitCSV("https://a.test"))
	require.Equal(t, []string{"a", "b"}, SplitCSV(" a, b "))
}
