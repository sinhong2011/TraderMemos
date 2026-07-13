package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseInstrumentTypeFromColumn(t *testing.T) {
	require.Equal(t, "option", ParseInstrumentType("OPTION", "AAPL"))
	require.Equal(t, "future", ParseInstrumentType("FUT", "ES"))
	require.Equal(t, "stock", ParseInstrumentType("EQUITY", "AAPL"))
}

func TestParseInstrumentTypeInfersFromSymbol(t *testing.T) {
	require.Equal(t, "option", ParseInstrumentType("", "AAPL 240119C00150000"))
	require.Equal(t, "option", ParseInstrumentType("", "TSLA240321P00250000"))
	require.Equal(t, "stock", ParseInstrumentType("", "AAPL"))
}

func TestParseOptionRightFromSymbol(t *testing.T) {
	require.Equal(t, "call", InferOptionRight("AAPL 240119C00150000"))
	require.Equal(t, "put", InferOptionRight("TSLA240321P00250000"))
	require.Equal(t, "call", ParseOptionRight("CALL"))
	require.Equal(t, "put", ParseOptionRight("P"))
	require.Equal(t, "", InferOptionRight("TSLA"))
}

func TestGenericImporterPerRowInstrumentType(t *testing.T) {
	rows := []map[string]string{
		{
			"Symbol": "AAPL", "Market": "STOCK", "B/S": "BUY", "Qty": "100",
			"Fill Price": "10.00", "Trade Date": "2026-01-01T10:00:00Z",
		},
		{
			"Symbol": "TSLA 240119C00200000", "Market": "OPTION", "B/S": "BUY", "Qty": "1",
			"Fill Price": "2.50", "Trade Date": "2026-01-02T10:00:00Z",
		},
		{
			"Symbol": "NVDA 240119C00150000", "B/S": "SELL", "Qty": "2",
			"Fill Price": "1.20", "Trade Date": "2026-01-03T10:00:00Z",
		},
	}
	mapping := map[string]string{
		"symbol": "Symbol", "side": "B/S", "quantity": "Qty",
		"price": "Fill Price", "executed_at": "Trade Date",
		"instrument_type": "Market",
	}
	res := NewGeneric(mapping).ParseRows(rows)
	require.Len(t, res.Executions, 3)
	require.Equal(t, "stock", res.Executions[0].InstrumentType)
	require.Equal(t, 1.0, res.Executions[0].Multiplier)
	require.Equal(t, "option", res.Executions[1].InstrumentType)
	require.Equal(t, "call", res.Executions[1].OptionRight)
	require.Equal(t, 100.0, res.Executions[1].Multiplier)
	require.Equal(t, "option", res.Executions[2].InstrumentType)
	require.Equal(t, "call", res.Executions[2].OptionRight)
}
