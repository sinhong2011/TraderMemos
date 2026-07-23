package importer

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseJSONUnifiedExportFixture(t *testing.T) {
	body, err := os.ReadFile("testdata/tradermemos-export-unified.json")
	require.NoError(t, err)

	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "journal_trades", got.Format)

	require.NotNil(t, got.Account)
	require.Equal(t, "Testing", got.Account.Name)
	require.Equal(t, "IBKR", got.Account.Broker)
	require.Equal(t, "USD", got.Account.BaseCurrency)
	require.NotNil(t, got.Account.StartingBalance)
	require.Equal(t, 10000.0, *got.Account.StartingBalance)

	require.Len(t, got.Cash, 1)
	require.Equal(t, "deposit", got.Cash[0].Type)
	require.InDelta(t, 1589.47, got.Cash[0].Amount, 0.01)

	require.Len(t, got.Setups, 5)
	require.Equal(t, "Breakout", got.Setups[0].Name)

	require.Empty(t, got.Result.Errors)
	require.GreaterOrEqual(t, len(got.Result.Executions), 10) // 5 trades × ≥2 fills
	require.Equal(t, "INTC", got.Result.Executions[0].Symbol)
	require.Equal(t, "option", got.Result.Executions[0].InstrumentType)
}
