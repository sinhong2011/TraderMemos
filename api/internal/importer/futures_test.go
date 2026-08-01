package importer_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

func TestFuturesRootCandidates(t *testing.T) {
	cases := []struct {
		symbol string
		want   []string
	}{
		{"ES", []string{"ES"}},
		{"/ES", []string{"ES"}},
		{"@ES", []string{"ES"}},
		{"ESZ5", []string{"ESZ5", "ES"}},
		{"ESZ25", []string{"ESZ25", "ES"}},
		{"NQH2026", []string{"NQH2026", "NQ"}},
		{"MGCJ24", []string{"MGCJ24", "MGC"}},
		{"M2K", []string{"M2K"}},
		{"M2KZ5", []string{"M2KZ5", "M2K"}},
		{"/ESZ5 GLOBEX", []string{"ESZ5", "ES"}},
		{"", nil},
		{"Z5", []string{"Z5"}}, // too short to split a root off
	}
	for _, tc := range cases {
		require.Equal(t, tc.want, importer.FuturesRootCandidates(tc.symbol), tc.symbol)
	}
}

func TestResolveMultiplier(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()
	require.NoError(t, store.SeedInstrumentSpecs(ctx, q))

	// Explicit multiplier always wins.
	require.Equal(t, 37.0, importer.ResolveMultiplier(ctx, q, "future", "ES", 37))
	// Futures resolve from instrument_specs by root, contract codes included.
	require.Equal(t, 50.0, importer.ResolveMultiplier(ctx, q, "future", "ES", 0))
	require.Equal(t, 50.0, importer.ResolveMultiplier(ctx, q, "future", "/ESZ5", 0))
	require.Equal(t, 2.0, importer.ResolveMultiplier(ctx, q, "future", "MNQ", 0))
	require.Equal(t, 5.0, importer.ResolveMultiplier(ctx, q, "future", "MESU25", 0))
	// Unknown future falls back to 1 rather than guessing.
	require.Equal(t, 1.0, importer.ResolveMultiplier(ctx, q, "future", "UNKNOWN", 0))
	// Non-futures keep the conventional defaults.
	require.Equal(t, 100.0, importer.ResolveMultiplier(ctx, q, "option", "AAPL 240119C00200000", 0))
	require.Equal(t, 1.0, importer.ResolveMultiplier(ctx, q, "stock", "AAPL", 0))
}
