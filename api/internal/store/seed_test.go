package store_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func TestSeedInstrumentSpecs(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	require.NoError(t, store.SeedInstrumentSpecs(context.Background(), q))
	es, err := q.GetInstrumentSpec(context.Background(), store.GetInstrumentSpecParams{SymbolRoot: "ES", InstrumentType: "future"})
	require.NoError(t, err)
	require.Equal(t, 50.0, es.Multiplier)
}
