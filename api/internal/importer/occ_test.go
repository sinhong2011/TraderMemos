package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseOCCSymbol(t *testing.T) {
	cases := []struct {
		symbol string
		want   OCCContract
		ok     bool
	}{
		{"MU 260821C01200000", OCCContract{"MU", "call", "1200", "2026-08-21"}, true},
		{"MU    260821C01200000", OCCContract{"MU", "call", "1200", "2026-08-21"}, true},
		{"TSLA240119P00200000", OCCContract{"TSLA", "put", "200", "2024-01-19"}, true},
		{"spy 261218c00650500", OCCContract{"SPY", "call", "650.5", "2026-12-18"}, true},
		{"BRK.B 260918P00450000", OCCContract{"BRK.B", "put", "450", "2026-09-18"}, true},
		{"AAPL", OCCContract{}, false},
		{"EURUSD", OCCContract{}, false},
		{"MU 260821C0120", OCCContract{}, false},   // strike not 8 digits
		{"MU 2608C01200000", OCCContract{}, false}, // date not 6 digits
		{"700", OCCContract{}, false},              // numeric ticker (HKEX)
	}
	for _, tc := range cases {
		got, ok := ParseOCCSymbol(tc.symbol)
		require.Equal(t, tc.ok, ok, tc.symbol)
		require.Equal(t, tc.want, got, tc.symbol)
	}
}

func TestParseStrikeAndExpiryCells(t *testing.T) {
	require.Equal(t, "103", parseStrikeCell("103"))
	require.Equal(t, "37.5", parseStrikeCell("37.50"))
	require.Equal(t, "1200", parseStrikeCell("1,200"))
	require.Equal(t, "", parseStrikeCell(""))
	require.Equal(t, "", parseStrikeCell("n/a"))

	require.Equal(t, "2026-08-17", parseExpiryCell("20260817"))
	require.Equal(t, "2026-08-17", parseExpiryCell("2026-08-17"))
	require.Equal(t, "2026-08-17", parseExpiryCell("08/17/2026"))
	require.Equal(t, "", parseExpiryCell("soon"))
}

// IBKR Flex rows with OCC option symbols come out with the contract moved into
// dedicated fields and the symbol reduced to the underlying, like manual entry.
func TestGenericNormalizesOCCOptionSymbols(t *testing.T) {
	name, mapping, tz, ok := MatchBroker([]string{
		"ClientAccountID", "Symbol", "Buy/Sell", "Quantity", "TradePrice",
		"DateTime", "IBCommission", "AssetClass", "Multiplier", "Put/Call",
	})
	require.True(t, ok)
	require.Contains(t, name, "Interactive Brokers")

	res := NewGeneric(mapping).WithSourceTZ(tz).ParseRows([]map[string]string{
		{
			"Symbol": "MU 260817C01030000", "Buy/Sell": "BUY", "Quantity": "5",
			"TradePrice": "3.84", "DateTime": "20260817;094500",
			"IBCommission": "-1.42", "AssetClass": "OPT", "Multiplier": "100", "Put/Call": "C",
		},
		{
			"Symbol": "AAPL", "Buy/Sell": "BUY", "Quantity": "100",
			"TradePrice": "10", "DateTime": "20260817;093000",
			"IBCommission": "-1.00", "AssetClass": "STK", "Multiplier": "1", "Put/Call": "",
		},
	})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 2)

	opt := res.Executions[0]
	require.Equal(t, "MU", opt.Symbol)
	require.Equal(t, "option", opt.InstrumentType)
	require.Equal(t, "call", opt.OptionRight)
	require.Equal(t, "1030", opt.Strike)
	require.Equal(t, "2026-08-17", opt.Expiry)

	stock := res.Executions[1]
	require.Equal(t, "AAPL", stock.Symbol)
	require.Empty(t, stock.Strike)
	require.Empty(t, stock.Expiry)
}

// Contracts sharing an underlying must not collide in the dedup key now that
// the symbol alone no longer identifies the contract.
func TestDedupSymbolSeparatesContracts(t *testing.T) {
	a := ParsedExecution{Symbol: "MU", InstrumentType: "option", OptionRight: "call", Strike: "103", Expiry: "2026-08-17"}
	b := ParsedExecution{Symbol: "MU", InstrumentType: "option", OptionRight: "call", Strike: "120", Expiry: "2026-08-17"}
	require.NotEqual(t, dedupSymbol(a), dedupSymbol(b))

	stock := ParsedExecution{Symbol: "MU", InstrumentType: "stock"}
	require.Equal(t, "MU", dedupSymbol(stock))
}
