package db_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
)

// Every bound time is stored as its UTC wall clock whatever location it
// carries, and reads back as the same instant.
func TestTimeStoredAsUTC_SQLite(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	defer conn.Close()

	_, err = conn.Exec(`CREATE TABLE ts (at TIMESTAMP NOT NULL)`)
	require.NoError(t, err)

	at := time.Date(2026, 9, 15, 9, 59, 0, 0, time.FixedZone("", -4*3600))
	var got time.Time
	require.NoError(t, conn.QueryRow(`INSERT INTO ts (at) VALUES (?) RETURNING at`, at).Scan(&got))
	require.True(t, got.Equal(at), got)
	require.Equal(t, time.UTC, got.Location())

	// Same text as a time bound in UTC, so rows sort and range-compare as before.
	var raw string
	require.NoError(t, conn.QueryRow(`SELECT CAST(at AS TEXT) FROM ts`).Scan(&raw))
	require.Equal(t, "2026-09-15 13:59:00 +0000 UTC", raw)

	var n int
	require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM ts WHERE at = ?`, at.UTC()).Scan(&n))
	require.Equal(t, 1, n)
}

func TestTimeStoredAsUTC_Postgres(t *testing.T) {
	url := os.Getenv("TM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TM_TEST_DATABASE_URL to run the Postgres timestamp test")
	}
	conn, err := db.Open(url)
	require.NoError(t, err)
	defer conn.Close()

	// Not TEMP: the pool may hand each statement a different connection.
	_, err = conn.Exec(`CREATE TABLE ts_utc_test (at TIMESTAMP NOT NULL)`)
	require.NoError(t, err)
	defer conn.Exec(`DROP TABLE ts_utc_test`)

	at := time.Date(2026, 9, 15, 9, 59, 0, 0, time.FixedZone("", -4*3600))
	var got time.Time
	require.NoError(t, conn.QueryRow(`INSERT INTO ts_utc_test (at) VALUES ($1) RETURNING at`, at).Scan(&got))
	require.True(t, got.Equal(at), got)

	var raw string
	require.NoError(t, conn.QueryRow(`SELECT at::text FROM ts_utc_test`).Scan(&raw))
	require.Equal(t, "2026-09-15 13:59:00", raw)
}
