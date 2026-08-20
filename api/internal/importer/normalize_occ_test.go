package importer_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

// Pre-fix broker imports stored raw OCC option symbols. The startup pass must
// rewrite them to underlying + contract details and leave the dedup hash where
// a re-sync of the same statement (now normalized at parse time) lands.
func TestNormalizeOCCOptionExecutions(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: "n@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "IB", BaseCurrency: "USD",
	})
	require.NoError(t, err)

	at, _ := time.Parse(time.RFC3339, "2026-08-17T13:45:00Z")
	legacy := "MU 260817C01030000"
	_, err = q.InsertExecution(ctx, store.InsertExecutionParams{
		ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID, Symbol: legacy,
		InstrumentType: "option", Side: "buy", Quantity: 5, Price: 3.84,
		ExecutedAt: at, Multiplier: 100,
		Details:   sql.NullString{String: `{"option_right":"call"}`, Valid: true},
		DedupHash: importer.DedupHash(legacy, "buy", 5, 3.84, at),
	})
	require.NoError(t, err)
	_, err = q.InsertExecution(ctx, store.InsertExecutionParams{
		ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID, Symbol: "AAPL",
		InstrumentType: "stock", Side: "buy", Quantity: 100, Price: 10,
		ExecutedAt: at, Multiplier: 1,
		DedupHash: importer.DedupHash("AAPL", "buy", 100, 10, at),
	})
	require.NoError(t, err)

	require.NoError(t, importer.NormalizeOCCOptionExecutions(ctx, q, slog.Default()))

	fills, err := q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: u.ID, AccountID: acc.ID})
	require.NoError(t, err)
	require.Len(t, fills, 2)
	byInstr := map[string]store.Execution{}
	for _, f := range fills {
		byInstr[f.InstrumentType] = f
	}

	opt := byInstr["option"]
	require.Equal(t, "MU", opt.Symbol)
	details := map[string]string{}
	require.NoError(t, json.Unmarshal([]byte(opt.Details.String), &details))
	require.Equal(t, "call", details["option_right"])
	require.Equal(t, "1030", details["strike"])
	require.Equal(t, "2026-08-17", details["expiry"])
	require.Equal(t, "AAPL", byInstr["stock"].Symbol)

	// Re-import of the same broker row, which parse-time normalization now
	// hands over as underlying + contract, must dedup against the rewritten fill.
	res, err := importer.Commit(ctx, q, u.ID, acc.ID, sql.NullString{}, importer.ParseResult{
		Format: "executions",
		Executions: []importer.ParsedExecution{{
			Symbol: "MU", InstrumentType: "option", OptionRight: "call",
			Strike: "1030", Expiry: "2026-08-17",
			Side: "buy", Quantity: 5, Price: 3.84, ExecutedAt: at, Multiplier: 100,
		}},
	})
	require.NoError(t, err)
	require.Equal(t, 0, res.Inserted)
	require.Equal(t, 1, res.Skipped)

	// Idempotent: nothing left to rewrite on the next boot.
	require.NoError(t, importer.NormalizeOCCOptionExecutions(ctx, q, slog.Default()))
	again, err := q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: u.ID, AccountID: acc.ID})
	require.NoError(t, err)
	require.Len(t, again, 2)
}
