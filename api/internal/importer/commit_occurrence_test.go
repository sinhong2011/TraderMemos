package importer_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"
	"uuid"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

// A broker splitting one 200-share order into two identical 100-share fills in
// the same second must keep both, and re-importing the file must add nothing.
func TestCommitKeepsIdenticalSameSecondFills(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.New().String(), Email: "o@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.New().String(), UserID: u.ID, Name: "M", BaseCurrency: "USD",
	})
	require.NoError(t, err)

	at := time.Date(2026, 7, 21, 13, 49, 30, 0, time.UTC)
	fill := func(side string, price float64, ts time.Time) importer.ParsedExecution {
		return importer.ParsedExecution{
			Symbol: "AAPL", InstrumentType: "stock", Side: side,
			Quantity: 100, Price: price, ExecutedAt: ts, Multiplier: 1,
		}
	}
	parsed := importer.ParseResult{
		Format: "executions",
		Executions: []importer.ParsedExecution{
			fill("buy", 200, at),
			fill("buy", 200, at),
			fill("sell", 201, at.Add(time.Minute)),
			fill("sell", 201, at.Add(time.Minute)),
		},
	}

	res, err := importer.Commit(ctx, q, u.ID, acc.ID, sql.NullString{}, parsed)
	require.NoError(t, err)
	require.Equal(t, 4, res.Inserted)
	require.Equal(t, 0, res.Skipped)

	res, err = importer.Commit(ctx, q, u.ID, acc.ID, sql.NullString{}, parsed)
	require.NoError(t, err)
	require.Equal(t, 0, res.Inserted, "re-import must dedup every repeat")
	require.Equal(t, 4, res.Skipped)

	trades, err := q.ListTrades(ctx, store.ListTradesParams{UserID: u.ID, AccountID: acc.ID})
	require.NoError(t, err)
	require.Len(t, trades, 1)
	require.InDelta(t, 200.0, trades[0].QtyOpened, 1e-9)
}

// Rows imported before occurrences existed carry the legacy hash; a re-import
// must still match them as occurrence 0 and only add the repeat that was lost.
func TestCommitOccurrenceZeroMatchesLegacyHash(t *testing.T) {
	at := time.Date(2026, 7, 21, 13, 49, 30, 0, time.UTC)
	require.Equal(t,
		importer.DedupHash("AAPL", "buy", 100, 200, at),
		importer.DedupHashOccurrence("AAPL", "buy", 100, 200, at, 0))
	require.NotEqual(t,
		importer.DedupHash("AAPL", "buy", 100, 200, at),
		importer.DedupHashOccurrence("AAPL", "buy", 100, 200, at, 1))
}
