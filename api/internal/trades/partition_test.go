package trades

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPartitionKeyOCCIgnoresSparseOptionDetails(t *testing.T) {
	sym := "TSLA 240119C00200000"
	withRight := sql.NullString{String: `{"option_right":"call"}`, Valid: true}
	empty := sql.NullString{}

	// Previously these diverged (…|call|| vs bare symbol|option) and left OPEN ghosts.
	require.Equal(t,
		partitionKey(sym, "option", withRight),
		partitionKey(sym, "option", empty),
	)
	require.Equal(t, sym+"|option", partitionKey(sym, "option", empty))
}

func TestPartitionKeyBareUnderlyingUsesInferredRight(t *testing.T) {
	withRight := sql.NullString{String: `{"option_right":"put"}`, Valid: true}
	empty := sql.NullString{}

	// Bare underlyings still need call/put when present; empty stays unscoped.
	require.Equal(t, "TSLA|option|put||", partitionKey("TSLA", "option", withRight))
	require.Equal(t, "TSLA|option", partitionKey("TSLA", "option", empty))
}

func TestPartitionKeyLotWins(t *testing.T) {
	details := sql.NullString{String: `{"lot":"r3","option_right":"call"}`, Valid: true}
	require.Equal(t, "NVDA|option|r3", partitionKey("NVDA", "option", details))
}
