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
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "9999", cfg.HTTPPort)
	require.Equal(t, "s3cr3t", cfg.JWTSecret)
}
