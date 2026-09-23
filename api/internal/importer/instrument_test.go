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

func TestInferSchwabTrailingRight(t *testing.T) {
	for _, sym := range []string{
		"DJT 05/30/2025 22.50 C",
		"DJT 05 30 2025 22.50 C",
	} {
		require.Equal(t, "option", InferInstrumentFromSymbol(sym), sym)
		require.Equal(t, "call", InferOptionRight(sym), sym)
	}
	require.Equal(t, "option", InferInstrumentFromSymbol("MRNA 05/23/2025 30.00 P"))
	require.Equal(t, "put", InferOptionRight("MRNA 05/23/2025 30.00 P"))
	// A one-letter ticker is not a call.
	require.Equal(t, "stock", InferInstrumentFromSymbol("C"))
	require.Equal(t, "", InferOptionRight("C"))
}

func TestSchwabOptionRowUsesContractMultiplier(t *testing.T) {
	rows := []map[string]string{{
		"Date": "05/28/2025", "Action": "Buy to Open",
		"Symbol":      "DJT 05/30/2025 22.50 C",
		"Description": "CALL TRUMP MEDIA & TECHN$22.5 EXP 05/30/25",
		"Quantity":    "1", "Price": "$0.95", "Fees & Comm": "$0.66", "Amount": "$0.95",
	}}
	mapping := map[string]string{
		"symbol": "Symbol", "side": "Action", "quantity": "Quantity",
		"price": "Price", "executed_at": "Date", "fees": "Fees & Comm",
	}
	res := NewGeneric(mapping).ParseRows(rows)
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 1)
	ex := res.Executions[0]
	require.Equal(t, "DJT", ex.Symbol)
	require.Equal(t, "option", ex.InstrumentType)
	require.Equal(t, "call", ex.OptionRight)
	require.Equal(t, "22.5", ex.Strike)
	require.Equal(t, "2025-05-30", ex.Expiry)
	require.Equal(t, 100.0, ex.Multiplier)
	require.Equal(t, "buy", ex.Side)
	require.Equal(t, 0.95, ex.Price)
}

func TestParseSchwabOptionSymbol(t *testing.T) {
	c, ok := ParseSchwabOptionSymbol("DJT 05/30/2025 22.50 C")
	require.True(t, ok)
	require.Equal(t, OCCContract{Underlying: "DJT", Right: "call", Strike: "22.5", Expiry: "2025-05-30"}, c)

	c, ok = ParseSchwabOptionSymbol("DJT 05 30 2025 22.50 C")
	require.True(t, ok)
	require.Equal(t, OCCContract{Underlying: "DJT", Right: "call", Strike: "22.5", Expiry: "2025-05-30"}, c)

	c, ok = ParseSchwabOptionSymbol("MRNA 05/23/2025 30.00 P")
	require.True(t, ok)
	require.Equal(t, "MRNA", c.Underlying)
	require.Equal(t, "put", c.Right)
	require.Equal(t, "30", c.Strike)

	_, ok = ParseSchwabOptionSymbol("AAPL")
	require.False(t, ok)
	_, ok = ParseSchwabOptionSymbol("C")
	require.False(t, ok)
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
