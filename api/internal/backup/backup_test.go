package backup

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
)

func quietLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// openTestDB opens a WAL-mode SQLite file the way the server does and seeds
// one row, so a snapshot has something to prove it carried over.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "live.db"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	_, err = conn.Exec(`CREATE TABLE trades (id TEXT PRIMARY KEY, symbol TEXT NOT NULL)`)
	require.NoError(t, err)
	_, err = conn.Exec(`INSERT INTO trades (id, symbol) VALUES ('t1', 'AAPL'), ('t2', 'MSFT')`)
	require.NoError(t, err)
	return conn
}

func newTestService(t *testing.T, conn *sql.DB, keep int) (*Service, string) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "backups")
	svc := New(conn, Config{Driver: "sqlite", Dir: dir, Keep: keep, Interval: 24 * time.Hour, Scheduled: true}, quietLogger())
	return svc, dir
}

// stepClock returns a clock that advances one second per call, so each run
// gets a distinct snapshot name.
func stepClock(start time.Time) func() time.Time {
	var mu sync.Mutex
	cur := start
	return func() time.Time {
		mu.Lock()
		defer mu.Unlock()
		cur = cur.Add(time.Second)
		return cur
	}
}

func dirNames(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names
}

func TestSnapshotIsAValidDatabaseWithTheData(t *testing.T) {
	conn := openTestDB(t)
	svc, dir := newTestService(t, conn, 14)
	svc.now = func() time.Time { return time.Date(2026, 10, 4, 9, 30, 15, 0, time.UTC) }

	f, err := svc.Run(context.Background())
	require.NoError(t, err)
	require.Equal(t, "tradermemos-20261004-093015Z.db", f.Name)
	require.Positive(t, f.SizeBytes)
	require.Equal(t, []string{f.Name}, dirNames(t, dir), "only the published snapshot remains")
	if runtime.GOOS != "windows" {
		info, err := os.Stat(filepath.Join(dir, f.Name))
		require.NoError(t, err)
		require.Equal(t, os.FileMode(0o600), info.Mode().Perm(), "snapshots are owner-only")
	}

	snap, err := sql.Open("sqlite", "file:"+filepath.Join(dir, f.Name)+"?mode=ro")
	require.NoError(t, err)
	defer snap.Close()
	var ok string
	require.NoError(t, snap.QueryRow(`PRAGMA integrity_check`).Scan(&ok))
	require.Equal(t, "ok", ok)
	var n int
	require.NoError(t, snap.QueryRow(`SELECT COUNT(*) FROM trades`).Scan(&n))
	require.Equal(t, 2, n)
	var sym string
	require.NoError(t, snap.QueryRow(`SELECT symbol FROM trades WHERE id = 't2'`).Scan(&sym))
	require.Equal(t, "MSFT", sym)

	st := svc.Status()
	require.Equal(t, StateOK, st.State)
	require.Equal(t, 1, st.FileCount)
	require.NotNil(t, st.Latest)
	require.Equal(t, f.Name, st.Latest.Name)
	require.Empty(t, st.LastError)
}

func TestRetentionKeepsNewestNAndIgnoresOtherFiles(t *testing.T) {
	conn := openTestDB(t)
	svc, dir := newTestService(t, conn, 3)
	svc.now = stepClock(time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC))

	require.NoError(t, os.MkdirAll(dir, 0o700))
	// Files the owner (or their sync tool) put here — none may be touched,
	// including ones that look almost like snapshots.
	unrelated := []string{
		"notes.txt",
		"tradermemos.db",
		"tradermemos-20200101-000000Z.db.bak",
		"tradermemos-20200101-000000.db",
		"old-tradermemos-20200101-000000Z.db",
	}
	for _, n := range unrelated {
		require.NoError(t, os.WriteFile(filepath.Join(dir, n), []byte("keep me"), 0o600))
	}

	var written []string
	for range 5 {
		f, err := svc.Run(context.Background())
		require.NoError(t, err)
		written = append(written, f.Name)
	}

	want := append([]string{}, unrelated...)
	want = append(want, written[2:]...)
	sort.Strings(want)
	require.Equal(t, want, dirNames(t, dir))

	st := svc.Status()
	require.Equal(t, 3, st.FileCount)
	require.Equal(t, written[4], st.Latest.Name)
}

func TestFailureAfterVacuumLeavesNoTempFile(t *testing.T) {
	conn := openTestDB(t)
	svc, dir := newTestService(t, conn, 14)
	var sawTemp string
	svc.afterVacuum = func(tmp string) error {
		_, err := os.Stat(tmp)
		require.NoError(t, err, "the temp file exists mid-run")
		sawTemp = tmp
		return errors.New("disk full")
	}

	_, err := svc.Run(context.Background())
	require.ErrorContains(t, err, "disk full")
	require.NotEmpty(t, sawTemp)
	require.True(t, strings.HasPrefix(filepath.Base(sawTemp), tempPrefix))
	require.Empty(t, dirNames(t, dir), "no partial snapshot or temp file survives")

	st := svc.Status()
	require.Equal(t, StateFailed, st.State)
	require.Contains(t, st.LastError, "disk full")
	require.NotNil(t, st.LastAttemptAt)
	require.Nil(t, st.LastSuccessAt)

	// The next good run clears the failure.
	svc.afterVacuum = nil
	_, err = svc.Run(context.Background())
	require.NoError(t, err)
	require.Equal(t, StateOK, svc.Status().State)
}

func TestFailureOnUnwritableDirLeavesNothing(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("permission bits are not enforced here")
	}
	conn := openTestDB(t)
	svc, dir := newTestService(t, conn, 14)
	require.NoError(t, os.MkdirAll(dir, 0o700))
	require.NoError(t, os.Chmod(dir, 0o500))
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })

	_, err := svc.Run(context.Background())
	require.Error(t, err)
	require.NoError(t, os.Chmod(dir, 0o700))
	require.Empty(t, dirNames(t, dir))
	require.Equal(t, StateFailed, svc.Status().State)
}

func TestStaleTempFromACrashIsCleared(t *testing.T) {
	conn := openTestDB(t)
	svc, dir := newTestService(t, conn, 14)
	require.NoError(t, os.MkdirAll(dir, 0o700))
	crashed := filepath.Join(dir, tempPrefix+"20261001-000000Z.db-deadbeef")
	require.NoError(t, os.WriteFile(crashed, []byte("half"), 0o600))

	f, err := svc.Run(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string{f.Name}, dirNames(t, dir))
}

func TestConcurrentRunIsRejected(t *testing.T) {
	conn := openTestDB(t)
	svc, _ := newTestService(t, conn, 14)
	entered := make(chan struct{})
	release := make(chan struct{})
	svc.afterVacuum = func(string) error {
		close(entered)
		<-release
		return nil
	}

	done := make(chan error, 1)
	go func() {
		_, err := svc.Run(context.Background())
		done <- err
	}()
	<-entered

	require.True(t, svc.Status().Running)
	_, err := svc.Run(context.Background())
	require.ErrorIs(t, err, ErrRunning)

	close(release)
	require.NoError(t, <-done)
	require.False(t, svc.Status().Running)
}

func TestStatusStates(t *testing.T) {
	conn := openTestDB(t)
	svc, _ := newTestService(t, conn, 14)
	base := time.Date(2026, 10, 4, 0, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return base }

	require.Equal(t, StateNone, svc.Status().State)

	_, err := svc.Run(context.Background())
	require.NoError(t, err)
	require.Equal(t, StateOK, svc.Status().State)

	due, err := svc.Due(0)
	require.NoError(t, err)
	require.False(t, due)

	svc.now = func() time.Time { return base.Add(25 * time.Hour) }
	due, err = svc.Due(0)
	require.NoError(t, err)
	require.True(t, due)
	require.Equal(t, StateOK, svc.Status().State, "one missed interval is not yet stale")

	svc.now = func() time.Time { return base.Add(49 * time.Hour) }
	require.Equal(t, StateStale, svc.Status().State)

	svc.cfg.Scheduled = false
	st := svc.Status()
	require.Equal(t, StateDisabled, st.State)
	require.False(t, st.Enabled)
}

func TestPostgresIsUnsupported(t *testing.T) {
	svc := New(nil, Config{Driver: "postgres", Dir: t.TempDir(), Scheduled: true}, quietLogger())
	st := svc.Status()
	require.Equal(t, StateUnsupported, st.State)
	require.False(t, st.Enabled)
	require.NotEmpty(t, st.Hint)
	require.Empty(t, st.LastError)
	require.Empty(t, st.Dir)

	_, err := svc.Run(context.Background())
	require.ErrorIs(t, err, ErrUnsupported)
}

func TestDefaults(t *testing.T) {
	svc := New(nil, Config{Driver: "sqlite"}, nil)
	require.Equal(t, DefaultKeep, svc.Config().Keep)
	require.Equal(t, DefaultInterval, svc.Config().Interval)
	require.Equal(t, filepath.Join("/srv/tm", "backups"), DefaultDir("/srv/tm/tradermemos.db"))
}
