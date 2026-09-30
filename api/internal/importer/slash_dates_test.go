package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDetectDayFirst(t *testing.T) {
	require.True(t, DetectDayFirst([]string{"05/01/2026 09:30:00", "13/01/2026 10:00:00"}))
	require.False(t, DetectDayFirst([]string{"05/01/2026 09:30:00", "01/13/2026 10:00:00"}))
	require.False(t, DetectDayFirst([]string{"05/01/2026", "06/02/2026"}), "unproven stays month-first")
	require.False(t, DetectDayFirst([]string{"2026-01-13 10:00:00"}))
	require.False(t, DetectDayFirst(nil))
}

// A DD/MM statement's ambiguous early-month rows must follow the file's proven
// order rather than silently read as month-first.
func TestGenericDayFirstFile(t *testing.T) {
	g := NewGeneric(map[string]string{
		"symbol": "Symbol", "side": "Side", "quantity": "Qty",
		"price": "Price", "executed_at": "Time",
	}).WithSourceTZ("Asia/Hong_Kong")
	res := g.ParseRows([]map[string]string{
		{"Symbol": "0700", "Side": "Buy", "Qty": "100", "Price": "400", "Time": "05/01/2026 09:30:00"},
		{"Symbol": "0700", "Side": "Sell", "Qty": "100", "Price": "410", "Time": "13/01/2026 15:59:00"},
	})
	require.Empty(t, res.Errors)
	require.Len(t, res.Executions, 2)
	hk, _ := time.LoadLocation("Asia/Hong_Kong")
	require.Equal(t, time.Date(2026, 1, 5, 9, 30, 0, 0, hk).UTC(), res.Executions[0].ExecutedAt)
	require.Equal(t, time.Date(2026, 1, 13, 15, 59, 0, 0, hk).UTC(), res.Executions[1].ExecutedAt)
}

func TestGenericMonthFirstUnchanged(t *testing.T) {
	g := NewGeneric(map[string]string{
		"symbol": "Symbol", "side": "Side", "quantity": "Qty",
		"price": "Price", "executed_at": "Time",
	})
	res := g.ParseRows([]map[string]string{
		{"Symbol": "AAPL", "Side": "Buy", "Qty": "1", "Price": "1", "Time": "05/01/2026 09:30:00"},
	})
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 5, 1, 9, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)
}

func TestParseTimeTwelveHourClock(t *testing.T) {
	for _, tc := range []struct {
		in       string
		dayFirst bool
		want     time.Time
	}{
		{"1/5/2026 3:04:05 PM", false, time.Date(2026, 1, 5, 15, 4, 5, 0, time.UTC)},
		{"01/05/2026 09:15 am", false, time.Date(2026, 1, 5, 9, 15, 0, 0, time.UTC)},
		{"13/1/2026 12:00 AM", true, time.Date(2026, 1, 13, 0, 0, 0, 0, time.UTC)},
		{"13/01/26 16:00", true, time.Date(2026, 1, 13, 16, 0, 0, 0, time.UTC)},
	} {
		got, err := parseTimeOrdered(tc.in, time.UTC, tc.dayFirst)
		require.NoError(t, err, tc.in)
		require.Equal(t, tc.want, got, tc.in)
	}
}
