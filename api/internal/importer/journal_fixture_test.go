package importer

import (
	"encoding/csv"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/trades"
)

func TestJournalFixtureNetPnlMatchesReturnColumn(t *testing.T) {
	f, err := os.Open("../../../tmp/imports/stonk-journal-trades-all-time-2026-07-11.csv")
	require.NoError(t, err)
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	require.NoError(t, err)

	headers := records[0]
	rows := make([]map[string]string, 0, len(records)-1)
	var expectedReturn float64
	for _, rec := range records[1:] {
		m := map[string]string{}
		for i, h := range headers {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		rows = append(rows, m)
		if v, ok := parseOptionalFloat(m["Return ($)"]); ok {
			expectedReturn += v
		}
	}

	res := NewJournal().ParseRows(rows)
	require.Empty(t, res.Errors)

	groups := map[string][]trades.Execution{}
	for _, pe := range res.Executions {
		key := pe.Symbol + "|" + pe.InstrumentType + "|" + pe.LotKey
		groups[key] = append(groups[key], trades.Execution{
			Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
			Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
			ExecutedAt: pe.ExecutedAt, Multiplier: pe.Multiplier, LotKey: pe.LotKey,
		})
	}

	var actual float64
	for _, g := range groups {
		for _, tr := range trades.Group(g) {
			if tr.NetPnl != nil {
				actual += *tr.NetPnl
			}
		}
	}

	t.Logf("expected return sum=%.2f grouped net pnl=%.2f trades=%d", expectedReturn, actual, len(rows))
	require.InDelta(t, expectedReturn, actual, 0.5)
}
