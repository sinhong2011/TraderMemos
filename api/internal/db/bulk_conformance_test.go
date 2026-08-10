package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/store"
)

// The set-at-a-time statements in store/bulk.go are hand-written per dialect —
// placeholder style, conflict clauses and the parameter ceiling all differ — so
// they get the same both-dialects treatment as the rest of the store.
func TestBulkWriterConformance(t *testing.T) {
	eachDriver(t, runBulkConformance)
}

func runBulkConformance(t *testing.T, q store.Querier) {
	t.Helper()
	ctx := context.Background()
	require.Implements(t, (*store.BulkWriter)(nil), q,
		"the driver store must take the batched path, not the row-at-a-time fallback")

	userID, accountID := seedUserAccount(t, q)

	// --- executions -----------------------------------------------------------
	// 240 rows × 16 params overflows the SQLite parameter ceiling, so this also
	// covers chunking across several statements.
	const nExec = 240
	execs := make([]store.InsertExecutionParams, nExec)
	base := time.Date(2026, 3, 2, 14, 30, 0, 0, time.UTC)
	for i := range execs {
		execs[i] = store.InsertExecutionParams{
			ID: uuid.NewString(), UserID: userID, AccountID: accountID,
			ExternalID: sql.NullString{String: fmt.Sprintf("ext-%d", i), Valid: true},
			Symbol:     "AAPL", InstrumentType: "stock", Side: "buy",
			Quantity: 10, Price: 100 + float64(i), Fees: 0.5, Commission: 1,
			ExecutedAt: base.Add(time.Duration(i) * time.Minute), Multiplier: 1,
			Details:   sql.NullString{String: `{"lot":"a"}`, Valid: true},
			DedupHash: fmt.Sprintf("hash-%s-%d", accountID, i),
		}
	}
	require.NoError(t, store.BulkInsertExecutions(ctx, q, execs))

	rows, err := q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{
		UserID: userID, AccountID: accountID,
	})
	require.NoError(t, err)
	require.Len(t, rows, nExec)
	require.Equal(t, "AAPL", rows[0].Symbol)
	require.Equal(t, 1.0, rows[0].Multiplier)
	require.True(t, rows[0].Details.Valid)
	require.True(t, rows[0].ExecutedAt.Equal(base), "executed_at must survive the round trip")

	// --- dedup hashes ---------------------------------------------------------
	probe := []string{
		execs[0].DedupHash, execs[nExec-1].DedupHash, "hash-absent-1", "hash-absent-2",
	}
	found, err := store.BulkExistingDedupHashes(ctx, q, accountID, probe)
	require.NoError(t, err)
	require.Contains(t, found, execs[0].DedupHash)
	require.Contains(t, found, execs[nExec-1].DedupHash)
	require.NotContains(t, found, "hash-absent-1")
	require.Len(t, found, 2)

	empty, err := store.BulkExistingDedupHashes(ctx, q, accountID, nil)
	require.NoError(t, err)
	require.Empty(t, empty)

	// --- trades, links, journals, tags ---------------------------------------
	tradeIDs := []string{execs[0].ID, execs[1].ID}
	upserts := []store.UpsertTradeParams{
		tradeParams(tradeIDs[0], userID, accountID, "AAPL", 111),
		tradeParams(tradeIDs[1], userID, accountID, "MSFT", 222),
	}
	require.NoError(t, store.BulkUpsertTrades(ctx, q, upserts))

	got, err := q.GetTrade(ctx, store.GetTradeParams{ID: tradeIDs[0], UserID: userID})
	require.NoError(t, err)
	require.Equal(t, "AAPL", got.Symbol)
	require.InDelta(t, 111.0, got.NetPnl.Float64, 0.001)

	// Upserting the same ids again must update in place, not duplicate or error.
	updated := tradeParams(tradeIDs[0], userID, accountID, "AAPL", 999)
	require.NoError(t, store.BulkUpsertTrades(ctx, q, []store.UpsertTradeParams{updated}))
	got, err = q.GetTrade(ctx, store.GetTradeParams{ID: tradeIDs[0], UserID: userID})
	require.NoError(t, err)
	require.InDelta(t, 999.0, got.NetPnl.Float64, 0.001)

	// The same id twice in one batch: last write wins, and Postgres must not see
	// "ON CONFLICT DO UPDATE command cannot affect row a second time".
	require.NoError(t, store.BulkUpsertTrades(ctx, q, []store.UpsertTradeParams{
		tradeParams(tradeIDs[0], userID, accountID, "AAPL", 1),
		tradeParams(tradeIDs[0], userID, accountID, "AAPL", 2),
	}))
	got, err = q.GetTrade(ctx, store.GetTradeParams{ID: tradeIDs[0], UserID: userID})
	require.NoError(t, err)
	require.InDelta(t, 2.0, got.NetPnl.Float64, 0.001)

	links := []store.LinkTradeExecutionParams{
		{TradeID: tradeIDs[0], ExecutionID: execs[0].ID},
		{TradeID: tradeIDs[0], ExecutionID: execs[2].ID},
		{TradeID: tradeIDs[1], ExecutionID: execs[1].ID},
	}
	require.NoError(t, store.BulkLinkTradeExecutions(ctx, q, links))
	linked, err := q.ListExecutionsForTrade(ctx, tradeIDs[0])
	require.NoError(t, err)
	require.Len(t, linked, 2)

	require.NoError(t, store.BulkClearTradeExecutions(ctx, q, tradeIDs))
	linked, err = q.ListExecutionsForTrade(ctx, tradeIDs[0])
	require.NoError(t, err)
	require.Empty(t, linked)
	require.NoError(t, store.BulkClearTradeExecutions(ctx, q, nil))

	journals := []store.UpsertTradeJournalParams{
		{TradeID: tradeIDs[0], UserID: userID, Notes: "first", EmotionalState: "calm",
			Confidence: sql.NullInt64{Int64: 4, Valid: true}},
		{TradeID: tradeIDs[1], UserID: userID, Notes: "second"},
		// Repeated trade id inside one batch — last one wins.
		{TradeID: tradeIDs[0], UserID: userID, Notes: "overwritten", EmotionalState: "calm",
			Mae: sql.NullFloat64{Float64: -12.5, Valid: true}},
	}
	require.NoError(t, store.BulkUpsertTradeJournals(ctx, q, journals))
	j, err := q.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeIDs[0], UserID: userID})
	require.NoError(t, err)
	require.Equal(t, "overwritten", j.Notes)
	require.InDelta(t, -12.5, j.Mae.Float64, 0.001)
	require.False(t, j.UpdatedAt.IsZero(), "updated_at literal must be filled in")

	tagA, err := q.CreateTag(ctx, store.CreateTagParams{
		ID: uuid.NewString(), UserID: userID, Name: "Breakout", Color: "#fff", Kind: "custom",
	})
	require.NoError(t, err)
	tagB, err := q.CreateTag(ctx, store.CreateTagParams{
		ID: uuid.NewString(), UserID: userID, Name: "Chased", Color: "#fff", Kind: "mistake",
	})
	require.NoError(t, err)
	tagLinks := []store.SetTradeTagsParams{
		{TradeID: tradeIDs[0], TagID: tagA.ID},
		{TradeID: tradeIDs[0], TagID: tagB.ID},
		{TradeID: tradeIDs[0], TagID: tagA.ID}, // duplicate inside the batch
		{TradeID: tradeIDs[1], TagID: tagA.ID},
	}
	require.NoError(t, store.BulkSetTradeTags(ctx, q, tagLinks))
	// Re-running must be a no-op, not a unique violation.
	require.NoError(t, store.BulkSetTradeTags(ctx, q, tagLinks))
	forTrade, err := q.ListTagsForTrade(ctx, tradeIDs[0])
	require.NoError(t, err)
	require.Len(t, forTrade, 2)

	// Empty input is always a no-op.
	require.NoError(t, store.BulkInsertExecutions(ctx, q, nil))
	require.NoError(t, store.BulkUpsertTrades(ctx, q, nil))
	require.NoError(t, store.BulkLinkTradeExecutions(ctx, q, nil))
	require.NoError(t, store.BulkUpsertTradeJournals(ctx, q, nil))
	require.NoError(t, store.BulkSetTradeTags(ctx, q, nil))
}
