package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGenericImporterParsesAndReportsBadRows(t *testing.T) {
	rows := []map[string]string{
		{"Symbol": "AAPL", "B/S": "BUY", "Qty": "100", "Fill Price": "10.00", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "1.00"},
		{"Symbol": "BADROW", "B/S": "BUY", "Qty": "notanumber", "Fill Price": "5", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "0"},
	}
	mapping := map[string]string{
		"symbol": "Symbol", "side": "B/S", "quantity": "Qty",
		"price": "Fill Price", "executed_at": "Trade Date", "commission": "Commission",
	}
	imp := NewGeneric(mapping)
	res := imp.ParseRows(rows)
	require.Len(t, res.Executions, 1)
	require.Equal(t, "buy", res.Executions[0].Side)
	require.Equal(t, 100.0, res.Executions[0].Quantity)
	require.Len(t, res.Errors, 1)
	require.Equal(t, 2, res.Errors[0].Row)
}
