package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "8080", cfg.HTTPPort)
	require.Equal(t, "sqlite", cfg.Driver)
	require.Equal(t, "data/tradermemos.db", cfg.DBPath)
	require.Equal(t, "sqlite:data/tradermemos.db", cfg.DatabaseURL)
	require.Equal(t, "USD", cfg.DefaultCurrency)
	require.False(t, cfg.AllowRegistration)
	require.False(t, cfg.AllowInsecureJWT)
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("TM_HTTP_PORT", "9999")
	t.Setenv("TM_JWT_SECRET", "s3cr3t-that-is-long-enough-32ch")
	t.Setenv("TM_CORS_ORIGINS", "https://app.example.com, http://localhost:5173")
	t.Setenv("TM_ALLOW_REGISTRATION", "true")
	t.Setenv("TM_ALLOW_INSECURE_JWT", "true")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "9999", cfg.HTTPPort)
	require.Equal(t, "s3cr3t-that-is-long-enough-32ch", cfg.JWTSecret)
	require.Equal(t, []string{"https://app.example.com", "http://localhost:5173"}, cfg.CORSOrigins)
	require.True(t, cfg.AllowRegistration)
	require.True(t, cfg.AllowInsecureJWT)
}

func TestLoadDatabaseURL(t *testing.T) {
	t.Setenv("TM_DATABASE_URL", "sqlite:///tmp/demo.db")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "sqlite", cfg.Driver)
	require.Equal(t, "/tmp/demo.db", cfg.DBPath)
	require.Equal(t, "sqlite:///tmp/demo.db", cfg.DatabaseURL)
}

func TestLoadLegacyDBPath(t *testing.T) {
	t.Setenv("TM_DB_PATH", "/data/legacy.db")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "sqlite", cfg.Driver)
	require.Equal(t, "/data/legacy.db", cfg.DBPath)
	require.Equal(t, "sqlite:///data/legacy.db", cfg.DatabaseURL)
}

func TestLoadDatabaseURLWinsOverDBPath(t *testing.T) {
	t.Setenv("TM_DATABASE_URL", "sqlite:///data/from-url.db")
	t.Setenv("TM_DB_PATH", "/data/from-path.db")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "/data/from-url.db", cfg.DBPath)
	require.Equal(t, "sqlite:///data/from-url.db", cfg.DatabaseURL)
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

func TestValidateAuth(t *testing.T) {
	require.Error(t, (Config{JWTSecret: DefaultInsecureJWTSecret}).ValidateAuth())
	require.Error(t, (Config{JWTSecret: "change-me"}).ValidateAuth())
	require.Error(t, (Config{JWTSecret: "short"}).ValidateAuth())
	require.NoError(t, (Config{JWTSecret: DefaultInsecureJWTSecret, AllowInsecureJWT: true}).ValidateAuth())
	require.NoError(t, (Config{JWTSecret: "abcdefghijklmnopqrstuvwxyz012345"}).ValidateAuth())
}

func TestIsInsecureJWTSecret(t *testing.T) {
	require.True(t, IsInsecureJWTSecret("change-me"))
	require.True(t, IsInsecureJWTSecret("too-short"))
	require.False(t, IsInsecureJWTSecret("abcdefghijklmnopqrstuvwxyz012345"))
}

