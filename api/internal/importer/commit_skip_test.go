package importer_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

func TestCommitSkipsJournalExitWhenEntryAlreadyExists(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: "j@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "M", BaseCurrency: "USD",
	})
	require.NoError(t, err)

	// Existing fill-level round trip (partial exits) — entry matches journal buy.
	openAt, _ := time.Parse(time.RFC3339, "2026-07-21T13:49:30Z")
	_, err = q.InsertExecution(ctx, store.InsertExecutionParams{
		ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID, Symbol: "AMD",
		InstrumentType: "option", Side: "buy", Quantity: 2, Price: 5.97,
		ExecutedAt: openAt, Multiplier: 100, DedupHash: importer.DedupHash("AMD", "buy", 2, 5.97, openAt),
		Details: sql.NullString{String: `{"lot":"existing","option_right":"call"}`, Valid: true},
	})
	require.NoError(t, err)

	lot := uuid.NewString()
	closeAt, _ := time.Parse(time.RFC3339, "2026-07-21T13:56:20Z")
	parsed := importer.ParseResult{
		Format: "journal_trades",
		Executions: []importer.ParsedExecution{
			{
				Symbol: "AMD", InstrumentType: "option", OptionRight: "call", Side: "buy",
				Quantity: 2, Price: 5.97, ExecutedAt: openAt, Multiplier: 100, LotKey: lot,
			},
			{
				Symbol: "AMD", InstrumentType: "option", OptionRight: "call", Side: "sell",
				Quantity: 2, Price: 5.79, ExecutedAt: closeAt, Multiplier: 100, LotKey: lot,
			},
		},
	}

	res, err := importer.Commit(ctx, q, u.ID, acc.ID, sql.NullString{}, parsed)
	require.NoError(t, err)
	require.Equal(t, 0, res.Inserted)
	require.Equal(t, 2, res.Skipped)

	fills, err := q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: u.ID, AccountID: acc.ID})
	require.NoError(t, err)
	require.Len(t, fills, 1) // only the pre-existing buy — no orphan avg-exit sell
}
