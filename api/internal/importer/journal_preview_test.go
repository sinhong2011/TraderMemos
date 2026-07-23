package importer

import (
	"encoding/csv"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildJournalPreviewFixture(t *testing.T) {
	f, err := os.Open("testdata/stonk-journal-trades-all-time-2026-07-11.csv")
	require.NoError(t, err)
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	require.NoError(t, err)

	headers := records[0]
	rows := make([]map[string]string, 0, len(records)-1)
	for _, rec := range records[1:] {
		m := map[string]string{}
		for i, h := range headers {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		rows = append(rows, m)
	}

	summary, samples := BuildJournalPreview(rows)
	require.Equal(t, 15, summary.RowCount)
	require.Equal(t, 15, summary.TradeCount)
	require.Equal(t, 30, summary.ExecutionCount)
	require.Equal(t, 7, summary.StockTrades)
	require.Equal(t, 8, summary.OptionTrades)
	require.InDelta(t, 172.01, summary.NetPnl, 0.01)
	require.Len(t, samples, 15)
	require.Equal(t, "SSPC", samples[0].Symbol)
	require.Equal(t, "STOCK", samples[0].Market)
	require.Equal(t, "stock", samples[0].InstrumentType)
	require.Equal(t, "", samples[0].OptionRight)
}
