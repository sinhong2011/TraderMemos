package db

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAndMigrate(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	conn, err := Open(path)
	require.NoError(t, err)
	defer conn.Close()

	require.NoError(t, Migrate(conn))
	require.NoError(t, conn.Ping())
}

func TestMigrateRecoversDirtyVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "dirty.db")
	conn, err := Open(path)
	require.NoError(t, err)
	defer conn.Close()

	require.NoError(t, Migrate(conn))

	_, err = conn.Exec(`UPDATE schema_migrations SET dirty = 1`)
	require.NoError(t, err)

	var dirty int
	require.NoError(t, conn.QueryRow(`SELECT dirty FROM schema_migrations`).Scan(&dirty))
	require.Equal(t, 1, dirty)

	require.NoError(t, Migrate(conn))
	require.NoError(t, conn.QueryRow(`SELECT dirty FROM schema_migrations`).Scan(&dirty))
	require.Equal(t, 0, dirty)
}
