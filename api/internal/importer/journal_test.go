package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIsJournalTradeCSV(t *testing.T) {
	headers := []string{"Date", "Symbol", "Status", "Market", "Side", "Qty", "Entry", "Exit", "Open Date", "Tags"}
	require.True(t, IsJournalTradeCSV(headers))
	require.Equal(t, "journal_trades", DetectFormat(headers))
	require.False(t, IsJournalTradeCSV([]string{"symbol", "side", "quantity", "price", "executed_at"}))
}

func TestJournalParseStockAndOption(t *testing.T) {
	rows := []map[string]string{
		{
			"Date": "2026-07-10T15:43:11.000Z", "Symbol": "SSPC", "Status": "LOSS", "Market": "STOCK",
			"Side": "LONG", "Qty": "120", "Entry": "13.17", "Exit": "13.18",
			"Entry Total": "1580.4", "Exit Total": "1581.6", "Position": "0",
			"Return ($)": "-1.86", "Return (%)": "-0.11", "Dividends": "0",
			"Open Date": "2026-07-10T15:41:29.000Z", "Tags": "", "Setup": "", "Confidence": "0",
			"Target": "", "Stop": "", "Notes": "",
		},
		{
			"Date": "2026-07-10T15:40:17.000Z", "Symbol": "TSLA", "Status": "WIN", "Market": "OPTION",
			"Side": "LONG", "Qty": "1", "Entry": "1.8", "Exit": "2",
			"Entry Total": "180", "Exit Total": "200", "Position": "0",
			"Return ($)": "18.88", "Return (%)": "10.48", "Dividends": "0",
			"Open Date": "2026-07-10T15:18:34.000Z", "Tags": "", "Setup": "", "Confidence": "0",
			"Target": "", "Stop": "", "Notes": "",
		},
		{
			"Date": "2026-07-08T15:59:34.000Z", "Symbol": "MULL", "Status": "WIN", "Market": "STOCK",
			"Side": "LONG", "Qty": "60", "Entry": "24.33", "Exit": "24.591666666666665",
			"Entry Total": "1459.8", "Exit Total": "1475.5", "Position": "0",
			"Return ($)": "11.67", "Dividends": "0",
			"Open Date": "2026-07-08T13:58:51.000Z",
			"Tags": "mistake:Early exit; mistake:No plan; setup:Pullback; emotion:Anxious",
			"Setup": "Pullback", "Confidence": "0", "Target": "25", "Stop": "24", "Notes": "cut early",
		},
	}
	res := NewJournal().ParseRows(rows)
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 6) // 3 trades × 2 fills
	require.NotEmpty(t, res.Executions[0].LotKey)
	require.Equal(t, res.Executions[0].LotKey, res.Executions[1].LotKey)
	require.NotEqual(t, res.Executions[0].LotKey, res.Executions[2].LotKey)

	sspcEntry := res.Executions[0]
	require.Equal(t, "SSPC", sspcEntry.Symbol)
	require.Equal(t, "stock", sspcEntry.InstrumentType)
	require.Equal(t, "buy", sspcEntry.Side)
	require.Equal(t, 120.0, sspcEntry.Quantity)
	require.Equal(t, 13.17, sspcEntry.Price)
	require.Equal(t, 1.0, sspcEntry.Multiplier)
	require.NotNil(t, sspcEntry.Annotation)
	sspcExit := res.Executions[1]
	require.Equal(t, "sell", sspcExit.Side)
	require.InDelta(t, 3.06, sspcEntry.Commission+sspcExit.Commission, 0.01)

	tslaEntry := res.Executions[2]
	require.Equal(t, "option", tslaEntry.InstrumentType)
	require.Equal(t, 100.0, tslaEntry.Multiplier)
	tslaExit := res.Executions[3]
	require.InDelta(t, 1.12, tslaEntry.Commission+tslaExit.Commission, 0.01)

	mull := res.Executions[4]
	require.NotNil(t, mull.Annotation)
	require.Equal(t, "Pullback", mull.Annotation.SetupName)
	require.Equal(t, "Anxious", mull.Annotation.Emotion)
	require.Equal(t, "cut early", mull.Annotation.Notes)
	require.NotNil(t, mull.Annotation.Target)
	require.Equal(t, 25.0, *mull.Annotation.Target)
	require.NotNil(t, mull.Annotation.Stop)
	require.Equal(t, 24.0, *mull.Annotation.Stop)
	require.Len(t, mull.Annotation.Tags, 2) // setup filtered out
	kinds := map[string]bool{}
	for _, tg := range mull.Annotation.Tags {
		kinds[tg.Kind+":"+tg.Name] = true
	}
	require.True(t, kinds["mistake:Early exit"])
	require.True(t, kinds["mistake:No plan"])
}

func TestParseJournalTags(t *testing.T) {
	tags, emotion := parseJournalTags("mistake:Early exit; emotion:Anxious; custom:foo")
	require.Equal(t, "Anxious", emotion)
	require.Len(t, tags, 2)
}

func TestJournalOpenDateParsed(t *testing.T) {
	row := map[string]string{
		"Date": "2026-07-01T14:28:35.000Z", "Symbol": "AMDL", "Market": "STOCK", "Side": "LONG",
		"Qty": "15", "Entry": "77.7", "Exit": "76.5", "Entry Total": "1165.5", "Exit Total": "1147.5",
		"Position": "0", "Return ($)": "-20.03", "Open Date": "2026-07-01T14:27:19.000Z",
	}
	fills, _, err := parseJournalRow(row, "")
	require.NoError(t, err)
	require.True(t, fills[0].ExecutedAt.Equal(time.Date(2026, 7, 1, 14, 27, 19, 0, time.UTC)))
	require.True(t, fills[1].ExecutedAt.Equal(time.Date(2026, 7, 1, 14, 28, 35, 0, time.UTC)))
}
