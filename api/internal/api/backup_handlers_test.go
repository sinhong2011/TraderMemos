package api_test

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/backup"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

type backupStatusBody struct {
	Enabled       bool       `json:"enabled"`
	Driver        string     `json:"driver"`
	Status        string     `json:"status"`
	Hint          string     `json:"hint"`
	Dir           string     `json:"dir"`
	Keep          int        `json:"keep"`
	IntervalMin   int        `json:"interval_min"`
	LastSuccessAt *time.Time `json:"last_success_at"`
	LastError     string     `json:"last_error"`
	FileCount     int        `json:"file_count"`
	Latest        *struct {
		Name      string `json:"name"`
		SizeBytes int64  `json:"size_bytes"`
	} `json:"latest"`
}

func testServerWithBackup(t *testing.T, driver string) (*api.Server, string) {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.NewForDriver(conn, "sqlite")
	j := auth.NewJWT("test")
	dir := filepath.Join(t.TempDir(), "backups")
	svc := backup.New(conn, backup.Config{
		Driver: driver, Dir: dir, Keep: 2, Interval: time.Hour, Scheduled: true,
	}, nil)
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Backup: svc,
	}), dir
}

func decodeBackupStatus(t *testing.T, body []byte) backupStatusBody {
	t.Helper()
	var out backupStatusBody
	require.NoError(t, json.Unmarshal(body, &out))
	return out
}

func TestBackupStatusAndRunNow(t *testing.T) {
	s, dir := testServerWithBackup(t, "sqlite")
	owner := registerAndLogin(t, s, "owner@example.com")

	rec := adminCall(t, s, http.MethodGet, "/admin/backup", "", owner)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	st := decodeBackupStatus(t, rec.Body.Bytes())
	require.True(t, st.Enabled)
	require.Equal(t, "sqlite", st.Driver)
	require.Equal(t, "none", st.Status)
	require.Equal(t, dir, st.Dir)
	require.Equal(t, 2, st.Keep)
	require.Equal(t, 60, st.IntervalMin)
	require.Nil(t, st.LastSuccessAt)
	require.Nil(t, st.Latest)

	rec = adminCall(t, s, http.MethodPost, "/admin/backup", "", owner)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	st = decodeBackupStatus(t, rec.Body.Bytes())
	require.Equal(t, "ok", st.Status)
	require.Equal(t, 1, st.FileCount)
	require.NotNil(t, st.LastSuccessAt)
	require.NotNil(t, st.Latest)
	require.Positive(t, st.Latest.SizeBytes)
	_, err := os.Stat(filepath.Join(dir, st.Latest.Name))
	require.NoError(t, err)
}

func TestBackupEndpointsAreOwnerOnly(t *testing.T) {
	s, dir := testServerWithBackup(t, "sqlite")
	registerAndLogin(t, s, "owner@example.com")
	member := registerAndLogin(t, s, "member@example.com")

	rec := adminCall(t, s, http.MethodGet, "/admin/backup", "", member)
	require.Equal(t, http.StatusForbidden, rec.Code)
	rec = adminCall(t, s, http.MethodPost, "/admin/backup", "", member)
	require.Equal(t, http.StatusForbidden, rec.Code)
	_, err := os.Stat(dir)
	require.ErrorIs(t, err, os.ErrNotExist, "a member's request never reaches the snapshot")

	rec = adminCall(t, s, http.MethodGet, "/admin/backup", "", "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestBackupFailureIsReported(t *testing.T) {
	s, dir := testServerWithBackup(t, "sqlite")
	owner := registerAndLogin(t, s, "owner@example.com")
	// A regular file where the directory should be makes every snapshot fail.
	require.NoError(t, os.WriteFile(dir, []byte("not a dir"), 0o600))

	rec := adminCall(t, s, http.MethodPost, "/admin/backup", "", owner)
	require.Equal(t, http.StatusInternalServerError, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), "backup_failed")

	rec = adminCall(t, s, http.MethodGet, "/admin/backup", "", owner)
	require.Equal(t, http.StatusOK, rec.Code)
	st := decodeBackupStatus(t, rec.Body.Bytes())
	require.Equal(t, "failed", st.Status)
	require.NotEmpty(t, st.LastError)
}

func TestBackupPostgresIsUnsupported(t *testing.T) {
	s, _ := testServerWithBackup(t, "postgres")
	owner := registerAndLogin(t, s, "owner@example.com")

	rec := adminCall(t, s, http.MethodGet, "/admin/backup", "", owner)
	require.Equal(t, http.StatusOK, rec.Code)
	st := decodeBackupStatus(t, rec.Body.Bytes())
	require.Equal(t, "unsupported", st.Status)
	require.Contains(t, st.Hint, "pg_dump")
	require.Empty(t, st.LastError)
	require.False(t, st.Enabled)

	rec = adminCall(t, s, http.MethodPost, "/admin/backup", "", owner)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "unsupported")
}

func TestBackupNotConfigured(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	rec := adminCall(t, s, http.MethodGet, "/admin/backup", "", owner)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}
