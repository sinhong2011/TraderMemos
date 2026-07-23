package db_test

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
)

// TestOpenMigrate_Postgres runs when TM_TEST_DATABASE_URL points at a Postgres DB.
// Example: TM_TEST_DATABASE_URL=postgres://tm:tm@localhost:5432/tradermemos_test?sslmode=disable
func TestOpenMigrate_Postgres(t *testing.T) {
	url := os.Getenv("TM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TM_TEST_DATABASE_URL to run Postgres open/migrate smoke test")
	}
	info, err := db.ParseURL(url)
	require.NoError(t, err)
	require.Equal(t, db.DriverPostgres, info.Driver)

	conn, err := db.Open(url)
	require.NoError(t, err)
	defer conn.Close()

	require.NoError(t, db.Migrate(conn, db.DriverPostgres))

	var n int
	err = conn.QueryRow(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`).Scan(&n)
	require.NoError(t, err)
	require.Equal(t, 1, n)
}
