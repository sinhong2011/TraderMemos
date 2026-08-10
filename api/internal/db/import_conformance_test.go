package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

// The two stores are separate sqlc outputs with hand-patched corners, so a
// query can be correct on SQLite and broken on Postgres. These run the same
// assertions on both — SQLite always, Postgres when TM_TEST_DATABASE_URL points
// at one — so a dialect slip cannot pass on SQLite alone.
func eachDriver(t *testing.T, run func(t *testing.T, q store.Querier)) {
	t.Helper()

	t.Run("sqlite", func(t *testing.T) {
		conn, err := db.Open(filepath.Join(t.TempDir(), "conformance.db"))
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		require.NoError(t, db.Migrate(conn))
		run(t, store.NewForDriver(conn, db.DriverSQLite))
	})

	t.Run("postgres", func(t *testing.T) {
		url := os.Getenv("TM_TEST_DATABASE_URL")
		if url == "" {
			t.Skip("set TM_TEST_DATABASE_URL to run the Postgres conformance tests")
		}
		conn, err := db.Open(url)
		require.NoError(t, err)
		t.Cleanup(func() { conn.Close() })
		require.NoError(t, db.Migrate(conn, db.DriverPostgres))
		run(t, store.NewForDriver(conn, db.DriverPostgres))
	})
}

// TestDeleteTradesNotInAccountConformance is a regression test for the Postgres
// slice expansion, which was a copy of the SQLite one: it looked for the
// `/*SLICE:keep*/?` marker (absent once sqlc renders `$3`) and emitted `?`
// placeholders. Any keep list other than exactly one id failed with "mismatched
// param and argument count", so every multi-trade regroup was broken.
func TestDeleteTradesNotInAccountConformance(t *testing.T) {
	eachDriver(t, func(t *testing.T, q store.Querier) {
		ctx := context.Background()
		userID, accountID := seedUserAccount(t, q)

		ids := make([]string, 4)
		for i := range ids {
			ids[i] = uuid.NewString()
			require.NoError(t, q.UpsertTrade(ctx, tradeParams(ids[i], userID, accountID, "KEEP", float64(i))))
		}

		keep := ids[:3]
		require.NoError(t, q.DeleteTradesNotInAccount(ctx, store.DeleteTradesNotInAccountParams{
			UserID: userID, AccountID: accountID, Keep: keep,
		}))
		for _, id := range keep {
			_, err := q.GetTrade(ctx, store.GetTradeParams{ID: id, UserID: userID})
			require.NoError(t, err, "kept trade %s should survive", id)
		}
		_, err := q.GetTrade(ctx, store.GetTradeParams{ID: ids[3], UserID: userID})
		require.Error(t, err, "trade outside the keep list should be deleted")

		// A single-id keep list was the only case that used to work — keep it covered.
		require.NoError(t, q.DeleteTradesNotInAccount(ctx, store.DeleteTradesNotInAccountParams{
			UserID: userID, AccountID: accountID, Keep: ids[:1],
		}))
		_, err = q.GetTrade(ctx, store.GetTradeParams{ID: ids[0], UserID: userID})
		require.NoError(t, err)
		_, err = q.GetTrade(ctx, store.GetTradeParams{ID: ids[1], UserID: userID})
		require.Error(t, err)
	})
}

// TestImportCommitConformance drives a journal import end to end on both
// dialects — insert, regroup, annotate.
func TestImportCommitConformance(t *testing.T) {
	eachDriver(t, func(t *testing.T, q store.Querier) {
		ctx := context.Background()
		userID, accountID := seedUserAccount(t, q)

		const nTrades = 40
		imported, err := importer.ParseJSONImport([]byte(exportFixture(nTrades)))
		require.NoError(t, err)
		require.Equal(t, "journal_trades", imported.Format)
		require.Empty(t, imported.Result.Errors, "fixture should parse cleanly")
		require.Len(t, imported.Result.Executions, nTrades*2)
		parsed := imported.Result

		res, err := importer.Commit(ctx, q, userID, accountID, sql.NullString{}, parsed)
		require.NoError(t, err)
		require.Empty(t, res.Errors)
		require.Equal(t, len(parsed.Executions), res.Inserted)
		require.Equal(t, nTrades, res.Annotated)

		trades, err := q.ListTrades(ctx, store.ListTradesParams{UserID: userID, AccountID: accountID})
		require.NoError(t, err)
		require.Len(t, trades, nTrades)

		journals, err := q.ListTradeJournalsForUser(ctx, userID)
		require.NoError(t, err)
		require.Len(t, journals, nTrades)
		require.Contains(t, journals[0].Notes, "review")
		require.True(t, journals[0].SetupID.Valid, "setup should be linked")

		tags, err := q.ListTags(ctx, userID)
		require.NoError(t, err)
		require.Len(t, tags, 2, "two distinct tag names across the file")

		// Committing the same file again must dedup every fill away.
		again, err := importer.Commit(ctx, q, userID, accountID, sql.NullString{}, parsed)
		require.NoError(t, err)
		require.Equal(t, 0, again.Inserted)
		require.Equal(t, res.Inserted, again.Skipped)

		trades, err = q.ListTrades(ctx, store.ListTradesParams{UserID: userID, AccountID: accountID})
		require.NoError(t, err)
		require.Len(t, trades, nTrades, "re-import must not duplicate trades")
	})
}

// exportFixture builds n closed trades in the app's own JSON export shape —
// the same file layout as docs/demo/tradermemos-demo-trades.json, and the one
// that walks the journal_trades import path.
func exportFixture(n int) string {
	var b strings.Builder
	b.WriteString(`{"format_version":1,"trades":[`)
	for i := range n {
		if i > 0 {
			b.WriteString(",")
		}
		open := time.Date(2026, 1, 5, 14, 30, 0, 0, time.UTC).Add(time.Duration(i) * 24 * time.Hour)
		closed := open.Add(2 * time.Hour)
		symbol := fmt.Sprintf("SYM%d", i%7)
		entry := 50.0
		exit := 50.0 + float64(i%5) - 2
		qty := 100.0
		fmt.Fprintf(&b, `{
  "symbol": %q, "instrument_type": "stock", "direction": "long", "status": "closed",
  "opened_at": %q, "closed_at": %q,
  "qty_opened": %g, "qty_remaining": 0,
  "avg_entry_price": %g, "avg_exit_price": %g,
  "gross_pnl": %g, "fees_total": 1, "net_pnl": %g, "pnl_currency": "USD",
  "notes": "trade %d review", "emotional_state": "Calm", "confidence": 4,
  "target_price": 55, "stop_price": 48,
  "tags": [{"name":"A+ setup","kind":"custom"},{"name":"Chased","kind":"mistake"}],
  "setup": {"name": %q},
  "fills": [
    {"symbol": %q, "side": "buy",  "quantity": %g, "price": %g, "fees": 0, "commission": 0, "executed_at": %q, "instrument_type": "stock", "multiplier": 1},
    {"symbol": %q, "side": "sell", "quantity": %g, "price": %g, "fees": 1, "commission": 0, "executed_at": %q, "instrument_type": "stock", "multiplier": 1}
  ]
}`,
			symbol, open.Format(time.RFC3339), closed.Format(time.RFC3339),
			qty, entry, exit, (exit-entry)*qty, (exit-entry)*qty-1, i,
			[]string{"Breakout", "Pullback"}[i%2],
			symbol, qty, entry, open.Format(time.RFC3339),
			symbol, qty, exit, closed.Format(time.RFC3339),
		)
	}
	b.WriteString("]}")
	return b.String()
}

func seedUserAccount(t *testing.T, q store.Querier) (userID, accountID string) {
	t.Helper()
	ctx := context.Background()
	id := uuid.NewString()
	u, err := q.CreateUser(ctx, store.CreateUserParams{
		ID: id, Email: id + "@conformance.test", PasswordHash: "x",
	})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "Conformance", Broker: "test",
		AccountType: "cash", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)
	return u.ID, acc.ID
}

func tradeParams(id, userID, accountID, symbol string, netPnl float64) store.UpsertTradeParams {
	opened := time.Date(2026, 3, 2, 14, 30, 0, 0, time.UTC)
	return store.UpsertTradeParams{
		ID: id, UserID: userID, AccountID: accountID, Symbol: symbol,
		InstrumentType: "stock", Direction: "long", Status: "closed",
		OpenedAt: opened, ClosedAt: sql.NullTime{Time: opened.Add(time.Hour), Valid: true},
		QtyOpened: 10, QtyRemaining: 0, AvgEntryPrice: 100,
		AvgExitPrice:    sql.NullFloat64{Float64: 110, Valid: true},
		GrossPnl:        sql.NullFloat64{Float64: netPnl + 1, Valid: true},
		FeesTotal:       1,
		NetPnl:          sql.NullFloat64{Float64: netPnl, Valid: true},
		PnlCurrency:     "USD",
		ReturnPct:       sql.NullFloat64{Float64: 10, Valid: true},
		RMultiple:       sql.NullFloat64{Float64: 2, Valid: true},
		TimeInTradeSecs: sql.NullInt64{Int64: 3600, Valid: true},
	}
}
