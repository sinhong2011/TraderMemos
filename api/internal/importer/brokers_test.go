package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/money"
	"github.com/tradermemos/api/internal/trades"
)

func TestMatchBrokerIBKR(t *testing.T) {
	headers := []string{
		"ClientAccountID", "Symbol", "Buy/Sell", "Quantity", "TradePrice",
		"DateTime", "IBCommission", "AssetClass", "Multiplier", "Put/Call",
	}
	name, mapping, _, ok := MatchBroker(headers)
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
	name, mapping, _, ok := MatchBroker(headers)
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
	name, mapping, _, ok := MatchBroker(headers)
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
	name, mapping, _, ok := MatchBroker(headers)
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
	name, mapping, _, ok := MatchBroker(headers)
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

func TestMatchBrokerCTraderSynthesizesRoundTrip(t *testing.T) {
	// Qualified headers ("Opening time (UTC+0)") must still answer to the
	// preset's bare signature names.
	headers := []string{
		"ID", "Symbol", "Opening direction", "Opening time (UTC+0)",
		"Closing time (UTC+0)", "Entry price", "Closing price",
		"Closing quantity", "Swap", "Commissions", "Pips", "Net (USD)",
	}
	name, mapping, tz, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "cTrader")
	require.Equal(t, "UTC", tz)
	require.Equal(t, "Opening time (UTC+0)", mapping["open_time"])
	require.True(t, LotSizedBroker(headers))

	g := NewGeneric(mapping).WithLotSizedQuantity(true)
	res := g.ParseRows([]map[string]string{{
		"Symbol": "EURUSD", "Opening direction": "Buy",
		"Opening time (UTC+0)": "10.07.2026 09:31:22",
		"Closing time (UTC+0)": "10.07.2026 11:02:00",
		"Entry price":          "1.0850", "Closing price": "1.0900",
		"Closing quantity": "0.5", "Swap": "-1.20", "Commissions": "-3.50",
	}})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 2)
	open, cls := res.Executions[0], res.Executions[1]
	require.Equal(t, "buy", open.Side)
	require.Equal(t, "sell", cls.Side)
	require.Equal(t, 1.0850, open.Price)
	require.Equal(t, 1.0900, cls.Price)
	require.Equal(t, time.Date(2026, 7, 10, 9, 31, 22, 0, time.UTC), open.ExecutedAt)
	require.Equal(t, time.Date(2026, 7, 10, 11, 2, 0, 0, time.UTC), cls.ExecutedAt)
	require.Equal(t, "forex", open.InstrumentType)
	// 0.5 lots of a currency pair → contract size 100k.
	require.Equal(t, 0.5, open.Quantity)
	require.Equal(t, 100_000.0, open.Multiplier)
	// Costs are counted once, on the closing fill, as positive magnitudes.
	require.Equal(t, 0.0, open.Commission+open.Fees)
	require.Equal(t, 3.50, cls.Commission)
	require.Equal(t, 1.20, cls.Fees)
	// Both fills share a lot so overlapping positions regroup separately.
	require.NotEmpty(t, open.LotKey)
	require.Equal(t, open.LotKey, cls.LotKey)
}

func TestMatchBrokerDXtrade(t *testing.T) {
	headers := []string{
		"Date and Time", "Symbol", "Status", "Side", "Filled Volume",
		"Fill Price", "Commission", "Take profit", "Stop loss",
	}
	name, mapping, tz, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "DXtrade")
	require.Equal(t, "UTC", tz)

	g := NewGeneric(mapping).WithLotSizedQuantity(LotSizedBroker(headers))
	res := g.ParseRows([]map[string]string{
		{
			"Date and Time": "2026-07-10 09:31:22", "Symbol": "EURUSD",
			"Status": "Filled", "Side": "Buy", "Filled Volume": "0.10",
			"Fill Price": "1.08543", "Commission": "-0.70",
		},
		{
			"Date and Time": "2026-07-10 09:32:00", "Symbol": "EURUSD",
			"Status": "Cancelled", "Side": "Sell", "Filled Volume": "0",
			"Fill Price": "",
		},
		{
			// Unit-denominated deployment: volume ≥1000 is already units,
			// not lots — keep multiplier 1.
			"Date and Time": "2026-07-10 10:15:00", "Symbol": "GBPUSD",
			"Status": "Filled", "Side": "Sell", "Filled Volume": "10000",
			"Fill Price": "1.29010", "Commission": "0.35",
		},
	})
	require.Empty(t, res.Errors) // cancelled row skipped, not an error
	require.Len(t, res.Executions, 2)
	require.Equal(t, "forex", res.Executions[0].InstrumentType)
	require.Equal(t, 0.10, res.Executions[0].Quantity)
	require.Equal(t, 100_000.0, res.Executions[0].Multiplier)
	require.Equal(t, 0.70, res.Executions[0].Commission)
	require.Equal(t, 1.0, res.Executions[1].Multiplier)
}

func TestMatchBrokerMatchTraderOpenPositionKeepsSingleFill(t *testing.T) {
	headers := []string{
		"Position", "Symbol", "Side", "Volume", "Open time", "Open price",
		"Close time", "Close price", "Commission", "Swap", "Net profit",
	}
	name, mapping, _, ok := MatchBroker(headers)
	require.True(t, ok)
	require.Contains(t, name, "Match-Trader")

	g := NewGeneric(mapping).WithLotSizedQuantity(LotSizedBroker(headers))
	res := g.ParseRows([]map[string]string{
		{
			"Symbol": "XAUUSD", "Side": "Sell", "Volume": "0.25",
			"Open time": "2026-07-10 09:31:22", "Open price": "2412.50",
			"Close time": "2026-07-10 14:00:05", "Close price": "2398.00",
			"Commission": "1.50", "Swap": "0",
		},
		{
			// Still-open position: no close columns → only the opening fill,
			// which then carries the costs.
			"Symbol": "EURUSD", "Side": "Buy", "Volume": "1",
			"Open time": "2026-07-10 15:45:00", "Open price": "1.0861",
			"Close time": "", "Close price": "", "Commission": "3.00",
		},
	})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 3)
	require.Equal(t, "sell", res.Executions[0].Side)
	require.Equal(t, "buy", res.Executions[1].Side)
	require.Equal(t, 100.0, res.Executions[0].Multiplier) // XAU lot = 100 oz
	require.Equal(t, res.Executions[0].LotKey, res.Executions[1].LotKey)
	open := res.Executions[2]
	require.Equal(t, "buy", open.Side)
	require.Equal(t, 3.00, open.Commission)
	require.NotEqual(t, res.Executions[0].LotKey, open.LotKey)
}

func TestLotContractSize(t *testing.T) {
	cases := map[string]float64{
		"EURUSD":   100_000,
		"EUR/USD":  100_000,
		"eurusd.r": 100_000,
		"XAUUSD":   100,
		"XAGUSD":   5000,
		"US30":     1,
		"NAS100":   1,
		"BTCUSD":   1,
	}
	for sym, want := range cases {
		require.Equal(t, want, LotContractSize(sym), sym)
	}
}

func TestMatchBrokerNoFalsePositiveOnGenericHeaders(t *testing.T) {
	_, _, _, ok := MatchBroker([]string{"symbol", "side", "quantity", "price", "executed_at"})
	require.False(t, ok)
}

// TestBrokerPresetNetPnlReconcilesStatementTotals verifies that round-trip
// broker presets (cTrader, Match-Trader) produce fills whose grouped net P&L
// matches each statement row's own Net column — price delta × qty × multiplier
// minus commission and swap/fees, rounded to cents like the trades engine.
func TestBrokerPresetNetPnlReconcilesStatementTotals(t *testing.T) {
	t.Run("cTrader", func(t *testing.T) {
		headers := []string{
			"ID", "Symbol", "Opening direction", "Opening time (UTC+0)",
			"Closing time (UTC+0)", "Entry price", "Closing price",
			"Closing quantity", "Swap", "Commissions", "Pips", "Net (USD)",
		}
		name, mapping, tz, ok := MatchBroker(headers)
		require.True(t, ok)
		require.Contains(t, name, "cTrader")

		rows := []map[string]string{{
			"Symbol": "EURUSD", "Opening direction": "Buy",
			"Opening time (UTC+0)": "10.07.2026 09:31:22",
			"Closing time (UTC+0)": "10.07.2026 11:02:00",
			"Entry price":          "1.0850", "Closing price": "1.0900",
			"Closing quantity": "0.5", "Swap": "-1.20", "Commissions": "-3.50",
			// (1.0900-1.0850)×0.5×100k − 3.50 commission − 1.20 swap
			"Net (USD)": "245.30",
		}}

		g := NewGeneric(mapping).WithSourceTZ(tz).WithLotSizedQuantity(LotSizedBroker(headers))
		res := g.ParseRows(rows)
		require.Empty(t, res.Errors)

		var statementTotal, importedTotal float64
		for i, row := range rows {
			stmtNet, ok := parseOptionalFloat(row["Net (USD)"])
			require.True(t, ok, "row %d missing Net (USD)", i+1)
			statementTotal += stmtNet

			importedNet, closed := roundTripNetPnl(res.Executions[i*2 : i*2+2])
			require.True(t, closed, "row %d should be a closed round-trip", i+1)
			require.Equal(t, money.Round2(stmtNet), money.Round2(importedNet),
				"row %d: statement Net (USD)=%.2f imported net=%.2f", i+1, stmtNet, importedNet)
			importedTotal += importedNet
		}
		require.Equal(t, money.Round2(statementTotal), money.Round2(importedTotal))
	})

	t.Run("Match-Trader", func(t *testing.T) {
		headers := []string{
			"Position", "Symbol", "Side", "Volume", "Open time", "Open price",
			"Close time", "Close price", "Commission", "Swap", "Net profit",
		}
		name, mapping, tz, ok := MatchBroker(headers)
		require.True(t, ok)
		require.Contains(t, name, "Match-Trader")

		rows := []map[string]string{
			{
				"Symbol": "XAUUSD", "Side": "Sell", "Volume": "0.25",
				"Open time": "2026-07-10 09:31:22", "Open price": "2412.50",
				"Close time": "2026-07-10 14:00:05", "Close price": "2398.00",
				"Commission": "1.50", "Swap": "0",
				// (2412.50−2398.00)×0.25×100 − 1.50 commission
				"Net profit": "361.00",
			},
			{
				// Still-open: no close columns and no statement net to reconcile.
				"Symbol": "EURUSD", "Side": "Buy", "Volume": "1",
				"Open time": "2026-07-10 15:45:00", "Open price": "1.0861",
				"Close time": "", "Close price": "", "Commission": "3.00",
			},
		}

		g := NewGeneric(mapping).WithSourceTZ(tz).WithLotSizedQuantity(LotSizedBroker(headers))
		res := g.ParseRows(rows)
		require.Empty(t, res.Errors)
		require.Len(t, res.Executions, 3) // closed pair + single open fill

		var statementTotal, importedTotal float64
		exIdx := 0
		for i, row := range rows {
			stmtNet, hasNet := parseOptionalFloat(row["Net profit"])
			if !hasNet {
				exIdx++ // open row: one fill only
				continue
			}
			statementTotal += stmtNet

			importedNet, closed := roundTripNetPnl(res.Executions[exIdx : exIdx+2])
			require.True(t, closed, "row %d should be a closed round-trip", i+1)
			require.Equal(t, money.Round2(stmtNet), money.Round2(importedNet),
				"row %d: statement Net profit=%.2f imported net=%.2f", i+1, stmtNet, importedNet)
			importedTotal += importedNet
			exIdx += 2
		}
		require.Equal(t, money.Round2(statementTotal), money.Round2(importedTotal))
	})
}

// roundTripNetPnl groups synthesized fills for one statement row through the
// trades engine and returns net P&L. closed is false when the row is still open.
func roundTripNetPnl(exs []ParsedExecution) (net float64, closed bool) {
	fills := make([]trades.Execution, len(exs))
	for i, pe := range exs {
		fills[i] = trades.Execution{
			Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
			Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
			ExecutedAt: pe.ExecutedAt, Multiplier: pe.Multiplier, LotKey: pe.LotKey,
		}
	}
	grouped := trades.Group(fills)
	if len(grouped) != 1 || grouped[0].NetPnl == nil {
		return 0, false
	}
	return *grouped[0].NetPnl, true
}
