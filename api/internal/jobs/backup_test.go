package jobs

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/backup"
	"github.com/tradermemos/api/internal/db"
)

func TestBackupJobSnapshotsOnlyWhenDue(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "live.db"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	_, err = conn.Exec(`CREATE TABLE t (x INTEGER)`)
	require.NoError(t, err)

	dir := filepath.Join(t.TempDir(), "backups")
	svc := backup.New(conn, backup.Config{
		Driver: "sqlite", Dir: dir, Keep: 14, Interval: 24 * time.Hour, Scheduled: true,
	}, discardLogger())
	job := NewBackup(svc, discardLogger())
	require.Equal(t, time.Hour, job.Every, "ticks hourly so a restart can't skip a day")
	require.Less(t, job.InitialDelay, time.Minute+1)

	// First boot with an empty directory: due immediately.
	require.NoError(t, job.Run(context.Background()))
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	require.Len(t, entries, 1)

	// The next tick finds a fresh snapshot and does nothing.
	require.NoError(t, job.Run(context.Background()))
	entries, err = os.ReadDir(dir)
	require.NoError(t, err)
	require.Len(t, entries, 1)
}

func TestBackupJobTickNeverExceedsInterval(t *testing.T) {
	svc := backup.New(nil, backup.Config{Driver: "sqlite", Dir: t.TempDir(), Interval: 5 * time.Minute}, discardLogger())
	require.Equal(t, 5*time.Minute, NewBackup(svc, discardLogger()).Every)
}
