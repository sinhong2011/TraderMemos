package importer

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func readFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	require.NoError(t, err)
	return data
}

func TestDetectMT5HTMLStatement(t *testing.T) {
	st, ok := DetectMTStatement(readFixture(t, "mt5-statement.html"))
	require.True(t, ok)
	require.Equal(t, "mt5", st.Platform)
	require.Equal(t, "MetaTrader 5 (Trade History Report)", st.BrokerName())
	// Balance deal + 3 good fills + 1 broken row; the totals row stops collection.
	require.Equal(t, 5, st.RowCount())
	require.Contains(t, st.Headers, "Deal")
	require.Contains(t, st.Headers, "Price") // MT5's single Price column keeps its name
}

func TestParseMT5Deals(t *testing.T) {
	st, ok := DetectMTStatement(readFixture(t, "mt5-statement.html"))
	require.True(t, ok)

	res := st.Parse("") // empty → broker server time (EET), never UTC
	require.Equal(t, "executions", res.Format)
	require.Len(t, res.Executions, 3) // balance deal skipped silently
	require.Len(t, res.Errors, 1)     // broken volume fails soft
	require.Equal(t, 5, res.Errors[0].Row)

	buy := res.Executions[0]
	require.Equal(t, "400101", buy.ExternalID)
	require.Equal(t, "EURUSD", buy.Symbol)
	require.Equal(t, "buy", buy.Side)
	require.Equal(t, "forex", buy.InstrumentType)
	require.InDelta(t, 0.5, buy.Quantity, 1e-9)
	require.InDelta(t, 1.09312, buy.Price, 1e-9)
	require.InDelta(t, 100000, buy.Multiplier, 1e-9)
	// 2024.01.15 10:30 EET (winter, UTC+2) → 08:30Z.
	require.Equal(t, time.Date(2024, 1, 15, 8, 30, 0, 0, time.UTC), buy.ExecutedAt)
	require.InDelta(t, 1.75, buy.Commission, 1e-9)
	require.InDelta(t, 0, buy.Fees, 1e-9)

	sell := res.Executions[1]
	require.Equal(t, "sell", sell.Side)
	// Swap stays in Fees, commission stays its own line.
	require.InDelta(t, 1.75, sell.Commission, 1e-9)
	require.InDelta(t, 1.20, sell.Fees, 1e-9)

	gold := res.Executions[2]
	require.Equal(t, "XAUUSD.M", gold.Symbol)
	require.Equal(t, "cfd", gold.InstrumentType)
	require.InDelta(t, 100, gold.Multiplier, 1e-9) // 1 lot = 100 oz
	require.InDelta(t, 2033.25, gold.Price, 1e-9)  // "2 033.25" NBSP thousands
}

func TestParseMT5SourceTZOverride(t *testing.T) {
	st, ok := DetectMTStatement(readFixture(t, "mt5-statement.html"))
	require.True(t, ok)
	res := st.Parse("UTC")
	require.Equal(t, time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)
}

func TestParseMT4Statement(t *testing.T) {
	st, ok := DetectMTStatement(readFixture(t, "mt4-statement.html"))
	require.True(t, ok)
	require.Equal(t, "mt4", st.Platform)
	require.Equal(t, "MetaTrader 4 (Statement)", st.BrokerName())
	// The duplicate Price pair is renamed so rows can be keyed by header.
	require.Contains(t, st.Headers, "Open Price")
	require.Contains(t, st.Headers, "Close Price")
	// Balance row, 2 closed trades, cancelled pending order, broken row;
	// "Closed P/L:" stops collection before Open Trades.
	require.Equal(t, 5, st.RowCount())

	res := st.Parse("")
	// 2 closed transactions → open+close fill pairs; balance + cancelled
	// skipped silently, broken open price fails soft.
	require.Len(t, res.Executions, 4)
	require.Len(t, res.Errors, 1)
	require.Equal(t, 5, res.Errors[0].Row)

	open, closeFill := res.Executions[0], res.Executions[1]
	require.Equal(t, "7100002-open", open.ExternalID)
	require.Equal(t, "7100002-close", closeFill.ExternalID)
	require.Equal(t, "GBPUSD", open.Symbol)
	require.Equal(t, "buy", open.Side)
	require.Equal(t, "sell", closeFill.Side)
	require.InDelta(t, 0.20, open.Quantity, 1e-9)
	require.InDelta(t, 1.27015, open.Price, 1e-9)
	require.InDelta(t, 1.27544, closeFill.Price, 1e-9)
	require.Equal(t, time.Date(2024, 1, 8, 7, 15, 0, 0, time.UTC), open.ExecutedAt)
	require.Equal(t, time.Date(2024, 1, 9, 14, 30, 0, 0, time.UTC), closeFill.ExecutedAt)
	// The pair shares a LotKey so overlapping positions regroup separately.
	require.Equal(t, "mt4-7100002", open.LotKey)
	require.Equal(t, open.LotKey, closeFill.LotKey)
	// Costs ride the closing fill; swap kept distinct from commission.
	require.InDelta(t, 0, open.Commission, 1e-9)
	require.InDelta(t, 2.00, closeFill.Commission, 1e-9)
	require.InDelta(t, 0.85, closeFill.Fees, 1e-9)

	short, cover := res.Executions[2], res.Executions[3]
	require.Equal(t, "USDJPY", short.Symbol)
	require.Equal(t, "sell", short.Side)
	require.Equal(t, "buy", cover.Side)
}

func TestDetectMT5XLSXStatement(t *testing.T) {
	st, ok := DetectMTStatement(readFixture(t, "mt5-statement.xlsx"))
	require.True(t, ok)
	require.Equal(t, "mt5", st.Platform)

	res := st.Parse("")
	require.Len(t, res.Executions, 2)
	require.Empty(t, res.Errors)
	// The buy's Time cell is an Excel date serial for 2024.01.15 08:30 broker
	// wall time → 06:30Z under the EET default.
	require.Equal(t, time.Date(2024, 1, 15, 6, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)
	require.Equal(t, time.Date(2024, 1, 15, 12, 45, 30, 0, time.UTC), res.Executions[1].ExecutedAt)
	require.Equal(t, "EURUSD", res.Executions[0].Symbol)
	require.InDelta(t, 0.5, res.Executions[0].Quantity, 1e-9)
}

func TestDetectRejectsNonStatements(t *testing.T) {
	_, ok := DetectMTStatement([]byte("Symbol,Side,Quantity\nAAPL,buy,10\n"))
	require.False(t, ok)
	require.Equal(t, "", SniffStatementContainer([]byte("Symbol,Side\nAAPL,buy\n")))

	_, ok = DetectMTStatement([]byte("<html><body><p>hello</p></body></html>"))
	require.False(t, ok)
	require.Equal(t, "html", SniffStatementContainer([]byte("<html><body><table></table></body></html>")))

	// A zip that isn't a workbook must not panic or match.
	_, ok = DetectMTStatement([]byte("PK\x03\x04garbage"))
	require.False(t, ok)
}

func TestMTInstrumentClassification(t *testing.T) {
	cases := []struct {
		symbol string
		typ    string
		mult   float64
	}{
		{"EURUSD", "forex", 100000},
		{"eurusd.m", "forex", 100000},
		{"GBPJPY-ECN", "forex", 100000},
		{"XAUUSD", "cfd", 100},
		{"XAGEUR", "cfd", 5000},
		{"BTCUSD", "crypto", 1},
		{"US30", "cfd", 1},
		{"AAPL", "cfd", 1},
	}
	for _, c := range cases {
		typ, mult := mtInstrument(c.symbol)
		require.Equal(t, c.typ, typ, c.symbol)
		require.InDelta(t, c.mult, mult, 1e-9, c.symbol)
	}
}
