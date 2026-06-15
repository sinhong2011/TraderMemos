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
