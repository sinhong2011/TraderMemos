package db_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func TestPostgresQuerier_CreateUser(t *testing.T) {
	url := os.Getenv("TM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TM_TEST_DATABASE_URL to run Postgres Querier smoke test")
	}
	conn, err := db.Open(url)
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, db.Migrate(conn, db.DriverPostgres))

	q := store.NewForDriver(conn, db.DriverPostgres)
	id := uuid.NewString()
	u, err := q.CreateUser(context.Background(), store.CreateUserParams{
		ID:           id,
		Email:        id + "@pg.test",
		PasswordHash: "hash",
		IsAdmin:      1,
	})
	require.NoError(t, err)
	require.Equal(t, id, u.ID)

	n, err := q.CountUsers(context.Background())
	require.NoError(t, err)
	require.GreaterOrEqual(t, n, int64(1))
}
