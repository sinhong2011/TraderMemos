package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMatchBrokerIBKR(t *testing.T) {
	headers := []string{
		"ClientAccountID", "Symbol", "Buy/Sell", "Quantity", "TradePrice",
		"DateTime", "IBCommission", "AssetClass", "Multiplier", "Put/Call",
	}
	name, mapping, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "Interactive Brokers")

	g := NewGeneric(mapping)
	res := g.ParseRows([]map[string]string{{
		"Symbol": "AAPL", "Buy/Sell": "SELL", "Quantity": "-100",
		"TradePrice": "231.5", "DateTime": "20260710;093122",
		"IBCommission": "-1.02", "AssetClass": "STK", "Multiplier": "1",
	}})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 1)
	ex := res.Executions[0]
	require.Equal(t, "sell", ex.Side)
	require.Equal(t, 100.0, ex.Quantity) // signed qty normalized to magnitude
	require.Equal(t, 231.5, ex.Price)
	require.Equal(t, "stock", ex.InstrumentType)
	require.Equal(t, time.Date(2026, 7, 10, 9, 31, 22, 0, time.UTC), ex.ExecutedAt)
	// IBKR reports commissions negative; they must land as positive cost.
	require.Equal(t, 1.02, ex.Commission)
}

func TestMatchBrokerThinkOrSwim(t *testing.T) {
	headers := []string{
		"Exec Time", "Spread", "Side", "Qty", "Pos Effect", "Symbol",
		"Exp", "Strike", "Type", "Price", "Net Price", "Order Type",
	}
	name, mapping, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "ThinkOrSwim")

	g := NewGeneric(mapping)
	res := g.ParseRows([]map[string]string{
		{
			"Exec Time": "7/10/26 09:31:22", "Side": "BOT", "Qty": "+2",
			"Symbol": "SPY", "Type": "STOCK", "Price": "552.31", "Pos Effect": "TO OPEN",
		},
		{
			"Exec Time": "7/10/26 10:02:00", "Side": "SOLD", "Qty": "-1",
			"Symbol": "TSLA", "Type": "CALL", "Price": "1.85", "Pos Effect": "TO CLOSE",
		},
	})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 2)
	require.Equal(t, "buy", res.Executions[0].Side)
	require.Equal(t, 2.0, res.Executions[0].Quantity)
	require.Equal(t, "sell", res.Executions[1].Side)
	require.Equal(t, "option", res.Executions[1].InstrumentType)
	require.Equal(t, "call", res.Executions[1].OptionRight)
}

func TestMatchBrokerWebullSkipsCancelled(t *testing.T) {
	headers := []string{
		"Name", "Symbol", "Side", "Status", "Filled", "Total Qty",
		"Price", "Avg Price", "Time-in-Force", "Placed Time", "Filled Time",
	}
	name, mapping, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "Webull")

	g := NewGeneric(mapping)
	res := g.ParseRows([]map[string]string{
		{
			"Symbol": "NVDA", "Side": "Buy", "Status": "Filled", "Filled": "50",
			"Avg Price": "128.44", "Filled Time": "07/10/2026 09:31:22 EDT",
		},
		{
			"Symbol": "NVDA", "Side": "Sell", "Status": "Cancelled", "Filled": "0",
			"Avg Price": "", "Filled Time": "",
		},
		{
			"Symbol": "AMD", "Side": "Short", "Status": "Filled", "Filled": "30",
			"Avg Price": "162.10", "Filled Time": "07/10/2026 10:15:00 EDT",
		},
	})
	require.Empty(t, res.Errors) // the cancelled row is skipped, not an error
	require.Len(t, res.Executions, 2)
	// 09:31 EDT == 13:31 UTC.
	require.Equal(t, time.Date(2026, 7, 10, 13, 31, 22, 0, time.UTC), res.Executions[0].ExecutedAt)
	require.Equal(t, "sell", res.Executions[1].Side) // Short normalizes to sell
}

func TestMatchBrokerTradovateForcesFutures(t *testing.T) {
	headers := []string{"Timestamp", "B/S", "Contract", "Product", "avgPrice", "filledQty"}
	name, mapping, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "Tradovate")
	require.Equal(t, "=future", mapping["instrument_type"])

	g := NewGeneric(mapping)
	res := g.ParseRows([]map[string]string{{
		"Timestamp": "2026-07-10 09:31:22", "B/S": "Buy", "Contract": "MESU6",
		"avgPrice": "5622.25", "filledQty": "2",
	}})
	require.Empty(t, res.Errors)
	require.Equal(t, "future", res.Executions[0].InstrumentType)
	// Multiplier stays 0 so commit can resolve it from instrument_specs.
	require.Equal(t, 0.0, res.Executions[0].Multiplier)
}

func TestMatchBrokerSchwab(t *testing.T) {
	headers := []string{"Date", "Action", "Symbol", "Description", "Quantity", "Price", "Fees & Comm", "Amount"}
	name, mapping, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "Schwab")

	g := NewGeneric(mapping)
	res := g.ParseRows([]map[string]string{{
		"Date": "07/10/2026", "Action": "Sell to Close", "Symbol": "AAPL",
		"Quantity": "100", "Price": "231.50", "Fees & Comm": "0.65",
	}})
	require.Empty(t, res.Errors)
	require.Equal(t, "sell", res.Executions[0].Side)
	require.Equal(t, 0.65, res.Executions[0].Fees)
}

func TestMatchBrokerNoFalsePositiveOnGenericHeaders(t *testing.T) {
	_, _, ok := MatchBroker([]string{"symbol", "side", "quantity", "price", "executed_at"})
	require.False(t, ok)
}
