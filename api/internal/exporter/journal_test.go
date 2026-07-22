package exporter

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/store"
)

func TestBuildJournalRowClosedTrade(t *testing.T) {
	closed := time.Date(2026, 1, 2, 11, 0, 0, 0, time.UTC)
	opened := time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC)
	row, ok := BuildJournalRow(JournalInput{
		Trade: store.Trade{
			Symbol: "AAPL", InstrumentType: "stock", Direction: "long", Status: "closed",
			OpenedAt: opened, ClosedAt: sql.NullTime{Time: closed, Valid: true},
			QtyOpened: 100, AvgEntryPrice: 10, AvgExitPrice: sql.NullFloat64{Float64: 12, Valid: true},
			NetPnl: sql.NullFloat64{Float64: 200, Valid: true}, ReturnPct: sql.NullFloat64{Float64: 20, Valid: true},
		},
		Journal: store.TradeJournal{
			Notes: "good trade", EmotionalState: "Calm",
			Confidence: sql.NullInt64{Int64: 4, Valid: true},
			TargetPrice: sql.NullFloat64{Float64: 15, Valid: true},
			StopPrice: sql.NullFloat64{Float64: 9, Valid: true},
		},
		Tags: []store.Tag{{Name: "FOMO", Kind: "mistake"}},
		Setup: "ORB",
	})
	require.True(t, ok)
	require.Equal(t, "WIN", row.Status)
	require.Equal(t, "LONG", row.Side)
	require.Equal(t, "STOCK", row.Market)
	require.Equal(t, 200.0, row.ReturnUSD)
	require.Equal(t, "ORB", row.Setup)
	require.Contains(t, row.Tags, "mistake:FOMO")
	require.Contains(t, row.Tags, "emotion:Calm")
}

func TestWriteJournalCSVRoundTripHeaders(t *testing.T) {
	closed := time.Date(2026, 1, 2, 11, 0, 0, 0, time.UTC)
	opened := time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC)
	row, ok := BuildJournalRow(JournalInput{
		Trade: store.Trade{
			Symbol: "AAPL", InstrumentType: "stock", Direction: "long", Status: "closed",
			OpenedAt: opened, ClosedAt: sql.NullTime{Time: closed, Valid: true},
			QtyOpened: 100, AvgEntryPrice: 10, AvgExitPrice: sql.NullFloat64{Float64: 12, Valid: true},
			NetPnl: sql.NullFloat64{Float64: 200, Valid: true},
		},
	})
	require.True(t, ok)

	var buf bytes.Buffer
	require.NoError(t, WriteJournalCSV(&buf, []JournalRow{row}))
	records, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	require.Equal(t, journalHeaders, records[0])
	require.Equal(t, "AAPL", records[1][1])
	require.Equal(t, "WIN", records[1][2])
}

func TestExportFilenameIncludesAccountName(t *testing.T) {
	name := ExportFilename("tradermemos-export", "Main Account #1", "json")
	require.Contains(t, name, "main-account-1")
	require.Contains(t, name, "tradermemos-export-")
	require.Contains(t, name, ".json")
}
