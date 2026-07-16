package store_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func TestSeedDefaultSetups(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	userID := uuid.NewString()
	_, err = q.CreateUser(ctx, store.CreateUserParams{
		ID: userID, Email: "seed@x.com", PasswordHash: "x",
	})
	require.NoError(t, err)

	require.NoError(t, store.SeedDefaultSetups(ctx, q, userID))
	setups, err := q.ListSetups(ctx, userID)
	require.NoError(t, err)
	require.Len(t, setups, len(store.DefaultSetupNames))

	// Idempotent — second run adds nothing.
	require.NoError(t, store.SeedDefaultSetups(ctx, q, userID))
	setups, err = q.ListSetups(ctx, userID)
	require.NoError(t, err)
	require.Len(t, setups, len(store.DefaultSetupNames))

	// Skips a pre-existing name (case-insensitive).
	otherID := uuid.NewString()
	_, err = q.CreateUser(ctx, store.CreateUserParams{
		ID: otherID, Email: "partial@x.com", PasswordHash: "x",
	})
	require.NoError(t, err)
	_, err = q.CreateSetup(ctx, store.CreateSetupParams{
		ID: uuid.NewString(), UserID: otherID, Name: "Pullback",
		Description: "", Thesis: "", Symbol: "", Direction: "",
		TargetPrice: sql.NullFloat64{}, StopPrice: sql.NullFloat64{}, Checklist: "[]",
	})
	require.NoError(t, err)
	require.NoError(t, store.SeedDefaultSetups(ctx, q, otherID))
	setups, err = q.ListSetups(ctx, otherID)
	require.NoError(t, err)
	require.Len(t, setups, len(store.DefaultSetupNames))
}
