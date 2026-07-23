package importer

import (
	"encoding/csv"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildJournalPreviewFixture(t *testing.T) {
	f, err := os.Open("testdata/tradermemos-export-journal.csv")
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
	require.Equal(t, 33, summary.RowCount)
	require.Equal(t, 33, summary.TradeCount)
	require.Equal(t, 66, summary.ExecutionCount)
	require.Equal(t, 12, summary.StockTrades)
	require.Equal(t, 21, summary.OptionTrades)
	require.InDelta(t, -186.17, summary.NetPnl, 0.01)
	require.Len(t, samples, 33)
	require.Equal(t, "AMDL", samples[0].Symbol)
	require.Equal(t, "STOCK", samples[0].Market)
	require.Equal(t, "stock", samples[0].InstrumentType)
	require.Equal(t, "", samples[0].OptionRight)
}
