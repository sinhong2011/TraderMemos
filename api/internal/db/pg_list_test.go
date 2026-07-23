package db_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func TestPostgresListQueries(t *testing.T) {
	url := os.Getenv("TM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TM_TEST_DATABASE_URL")
	}
	conn, err := db.Open(url)
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, db.Migrate(conn, db.DriverPostgres))
	q := store.NewForDriver(conn, db.DriverPostgres)
	u, err := q.GetUserByEmail(context.Background(), "local@pg.test")
	require.NoError(t, err)

	_, err = q.ListTrades(context.Background(), store.ListTradesParams{UserID: u.ID})
	require.NoError(t, err, "ListTrades")
	_, err = q.ListCashTransactions(context.Background(), store.ListCashTransactionsParams{UserID: u.ID})
	require.NoError(t, err, "ListCash")
	_, err = q.ListClosedTrades(context.Background(), store.ListClosedTradesParams{UserID: u.ID})
	require.NoError(t, err, "ListClosed")
	_, err = q.ListJournalNotes(context.Background(), store.ListJournalNotesParams{UserID: u.ID})
	require.NoError(t, err, "ListJournalNotes")
}
