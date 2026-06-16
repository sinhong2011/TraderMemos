package trades_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func TestRegroupPersistsClosedTrade(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, _ := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: "a@b.com", PasswordHash: "x"})
	acc, _ := q.CreateAccount(ctx, store.CreateAccountParams{ID: uuid.NewString(), UserID: u.ID, Name: "M", BaseCurrency: "USD"})

	mk := func(side string, qty, price float64, ts string) {
		tt, _ := time.Parse(time.RFC3339, ts)
		_, err := q.InsertExecution(ctx, store.InsertExecutionParams{
			ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID, Symbol: "AAPL",
			InstrumentType: "stock", Side: side, Quantity: qty, Price: price,
			ExecutedAt: tt, Multiplier: 1, DedupHash: uuid.NewString(),
		})
		require.NoError(t, err)
	}
	mk("buy", 100, 10, "2026-01-01T10:00:00Z")
	mk("sell", 100, 12, "2026-01-01T11:00:00Z")

	svc := trades.NewService(q)
	require.NoError(t, svc.Regroup(ctx, u.ID, acc.ID))

	closed, err := q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: u.ID})
	require.NoError(t, err)
	require.Len(t, closed, 1)
	require.True(t, closed[0].NetPnl.Valid)
	require.Equal(t, 200.0, closed[0].NetPnl.Float64)
}
