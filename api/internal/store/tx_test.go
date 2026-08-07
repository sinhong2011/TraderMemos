package store_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func newDriverStore(t *testing.T) store.Querier {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	t.Cleanup(func() { conn.Close() })
	return store.NewForDriver(conn, "sqlite")
}

func TestInTxCommitsOnSuccess(t *testing.T) {
	q := newDriverStore(t)
	ctx := context.Background()

	uid := uuid.NewString()
	err := store.InTx(ctx, q, func(tq store.Querier) error {
		_, err := tq.CreateUser(ctx, store.CreateUserParams{ID: uid, Email: "a@b.com", PasswordHash: "x"})
		return err
	})
	require.NoError(t, err)

	_, err = q.GetUserByID(ctx, uid)
	require.NoError(t, err)
}

func TestInTxRollsBackOnError(t *testing.T) {
	q := newDriverStore(t)
	ctx := context.Background()

	uid := uuid.NewString()
	boom := errors.New("boom")
	err := store.InTx(ctx, q, func(tq store.Querier) error {
		if _, err := tq.CreateUser(ctx, store.CreateUserParams{ID: uid, Email: "a@b.com", PasswordHash: "x"}); err != nil {
			return err
		}
		return boom
	})
	require.ErrorIs(t, err, boom)

	_, err = q.GetUserByID(ctx, uid)
	require.Error(t, err, "user insert should have been rolled back")
}

func TestInTxFallsBackWithoutTxRunner(t *testing.T) {
	plain, done := newStore(t)
	defer done()
	ctx := context.Background()

	uid := uuid.NewString()
	err := store.InTx(ctx, plain, func(tq store.Querier) error {
		_, err := tq.CreateUser(ctx, store.CreateUserParams{ID: uid, Email: "a@b.com", PasswordHash: "x"})
		return err
	})
	require.NoError(t, err)
	_, err = plain.GetUserByID(ctx, uid)
	require.NoError(t, err)
}
