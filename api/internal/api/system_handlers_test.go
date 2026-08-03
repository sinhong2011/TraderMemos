package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServerWithSystemInfo(t *testing.T) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Driver:   db.DriverSQLite,
		Features: map[string]bool{"econ_calendar": true, "market_data": false},
	})
}

func TestSystemInfo(t *testing.T) {
	s := testServerWithSystemInfo(t)
	tok := registerAndLogin(t, s, "sysinfo@example.com")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system/info", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var body struct {
		Version   string          `json:"version"`
		Go        string          `json:"go"`
		StartedAt string          `json:"started_at"`
		UptimeSec int64           `json:"uptime_sec"`
		DBDriver  string          `json:"db_driver"`
		Features  map[string]bool `json:"features"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.NotEmpty(t, body.Version)
	require.NotEmpty(t, body.Go)
	require.NotEmpty(t, body.StartedAt)
	require.GreaterOrEqual(t, body.UptimeSec, int64(0))
	require.Equal(t, db.DriverSQLite, body.DBDriver)
	require.Equal(t, map[string]bool{"econ_calendar": true, "market_data": false}, body.Features)
}

func TestSystemInfoRequiresAuth(t *testing.T) {
	s := testServerWithSystemInfo(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/system/info", nil)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
