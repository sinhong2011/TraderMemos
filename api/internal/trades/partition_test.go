package trades

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPartitionKey_usesLotWhenPresent(t *testing.T) {
	key := partitionKey("TSLA", "option", sql.NullString{
		String: `{"lot":"j1","option_right":"put","strike":"360"}`,
		Valid:  true,
	})
	require.Equal(t, "TSLA|option|j1", key)
}

func TestPartitionKey_usesContractWhenNoLot(t *testing.T) {
	a := partitionKey("TSLA", "option", sql.NullString{
		String: `{"option_right":"put","strike":"360","expiry":"2026-07-24"}`,
		Valid:  true,
	})
	b := partitionKey("TSLA", "option", sql.NullString{
		String: `{"option_right":"call","strike":"370","expiry":"2026-07-24"}`,
		Valid:  true,
	})
	require.Equal(t, "TSLA|option|put|360|2026-07-24", a)
	require.Equal(t, "TSLA|option|call|370|2026-07-24", b)
	require.NotEqual(t, a, b)
}

func TestPartitionKey_numericStrike(t *testing.T) {
	key := partitionKey("TSLA", "option", sql.NullString{
		String: `{"option_right":"put","strike":360,"expiry":"2026-07-24"}`,
		Valid:  true,
	})
	require.Equal(t, "TSLA|option|put|360|2026-07-24", key)
}

func TestPartitionKey_stockWithoutDetails(t *testing.T) {
	require.Equal(t, "AAPL|stock", partitionKey("AAPL", "stock", sql.NullString{}))
}
