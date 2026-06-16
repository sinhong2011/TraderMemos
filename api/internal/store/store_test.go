package store_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func newStore(t *testing.T) (*store.Queries, func()) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	return store.New(conn), func() { conn.Close() }
}

func TestUserAccountRoundTrip(t *testing.T) {
	q, done := newStore(t)
	defer done()
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{
		ID: uuid.NewString(), Email: "a@b.com", PasswordHash: "x",
	})
	require.NoError(t, err)

	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "Main",
		Broker: "ibkr", AccountType: "margin", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)

	got, err := q.GetAccount(ctx, store.GetAccountParams{ID: acc.ID, UserID: u.ID})
	require.NoError(t, err)
	require.Equal(t, "Main", got.Name)
	require.WithinDuration(t, time.Now(), got.CreatedAt, time.Minute)
}
