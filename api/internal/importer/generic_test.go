package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGenericImporterParsesAndReportsBadRows(t *testing.T) {
	rows := []map[string]string{
		{"Symbol": "AAPL", "B/S": "BUY", "Qty": "100", "Fill Price": "10.00", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "1.00"},
		{"Symbol": "BADROW", "B/S": "BUY", "Qty": "notanumber", "Fill Price": "5", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "0"},
	}
	mapping := map[string]string{
		"symbol": "Symbol", "side": "B/S", "quantity": "Qty",
		"price": "Fill Price", "executed_at": "Trade Date", "commission": "Commission",
	}
	imp := NewGeneric(mapping)
	res := imp.ParseRows(rows)
	require.Len(t, res.Executions, 1)
	require.Equal(t, "buy", res.Executions[0].Side)
	require.Equal(t, 100.0, res.Executions[0].Quantity)
	require.Len(t, res.Errors, 1)
	require.Equal(t, 2, res.Errors[0].Row)
}

func TestParseMoney(t *testing.T) {
	t.Parallel()
	ok := []struct {
		in   string
		want float64
	}{
		{"10.00", 10},
		{"$23.145", 23.145},
		{" $1,234.56 ", 1234.56},
		{"($1.02)", -1.02},
		{"-$1.25", -1.25},
		{"$-0.40", -0.40},
		{"US$400.00", 400},
		{"USD 1.00", 1},
		{"-1.02", -1.02},
		{"23.145$", 23.145},
	}
	for _, tc := range ok {
		got, err := parseMoney(tc.in)
		require.NoError(t, err, tc.in)
		require.Equal(t, tc.want, got, tc.in)
	}
	for _, in := range []string{"", "$", "abc", "()", "(abc)"} {
		_, err := parseMoney(in)
		require.Error(t, err, in)
	}
}

// Brokers (Schwab, some IBKR/Webull exports) write money cells with a
// currency glyph, thousands separators, or accounting parentheses. Price
// must parse; fees/commission must not silently become 0.
func TestGenericImporterParsesBrokerMoneyFormats(t *testing.T) {
	mapping := map[string]string{
		"symbol": "Symbol", "side": "Side", "quantity": "Qty",
		"price": "Price", "executed_at": "When",
		"commission": "Commission", "fees": "Fees",
	}
	cases := []struct {
		name                          string
		price, commission, fees       string
		wantPrice, wantComm, wantFees float64
	}{
		{name: "dollar prefix", price: "$23.145", commission: "$1.02", fees: "$0.07",
			wantPrice: 23.145, wantComm: 1.02, wantFees: 0.07},
		{name: "thousands comma", price: "$1,234.56", commission: "$0.00", fees: "$1.00",
			wantPrice: 1234.56, wantComm: 0, wantFees: 1},
		{name: "accounting parens", price: "10.00", commission: "($1.02)", fees: "($0.50)",
			wantPrice: 10, wantComm: 1.02, wantFees: 0.50},
		{name: "leading minus with dollar", price: "10.00", commission: "-$1.25", fees: "$-0.40",
			wantPrice: 10, wantComm: 1.25, wantFees: 0.40},
		{name: "currency code prefix", price: "US$400.00", commission: "USD 1.00", fees: "",
			wantPrice: 400, wantComm: 1, wantFees: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := NewGeneric(mapping).ParseRows([]map[string]string{{
				"Symbol": "ACME", "Side": "SELL", "Qty": "100",
				"Price": tc.price, "When": "2026-09-14T14:30:00Z",
				"Commission": tc.commission, "Fees": tc.fees,
			}})
			require.Empty(t, res.Errors, res.Errors)
			require.Len(t, res.Executions, 1)
			ex := res.Executions[0]
			require.Equal(t, tc.wantPrice, ex.Price)
			require.Equal(t, tc.wantComm, ex.Commission)
			require.Equal(t, tc.wantFees, ex.Fees)
		})
	}
}

// Naive broker timestamps are the broker's wall clock, not UTC. A Friday
// 16:30 ET fill read as UTC would land on the wrong instant (and late-Friday
// fills on Saturday once bucketed) — WithSourceTZ pins the source zone.
func TestGenericImporterSourceTimezone(t *testing.T) {
	mapping := map[string]string{
		"symbol": "Symbol", "side": "Side", "quantity": "Qty",
		"price": "Price", "executed_at": "Exec Time",
	}
	row := func(ts string) []map[string]string {
		return []map[string]string{{
			"Symbol": "SPY", "Side": "BUY", "Qty": "1", "Price": "550", "Exec Time": ts,
		}}
	}

	// Offset-less time in source zone: 2026-07-10 is EDT (UTC-4).
	res := NewGeneric(mapping).WithSourceTZ("America/New_York").ParseRows(row("2026-07-10 16:30:00"))
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 7, 10, 20, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)

	// Date-only rows land at source-zone midnight, not UTC midnight (which
	// would render as the previous evening — or Sunday — in market time).
	res = NewGeneric(mapping).WithSourceTZ("America/New_York").ParseRows(row("07/13/2026"))
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 7, 13, 4, 0, 0, 0, time.UTC), res.Executions[0].ExecutedAt)

	// An explicit RFC3339 offset always wins over the source zone.
	res = NewGeneric(mapping).WithSourceTZ("America/New_York").ParseRows(row("2026-07-10T16:30:00+08:00"))
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 7, 10, 8, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)

	// A trailing US tz abbreviation (Webull) also wins over the source zone.
	res = NewGeneric(mapping).WithSourceTZ("America/Chicago").ParseRows(row("07/10/2026 09:31:22 EDT"))
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 7, 10, 13, 31, 22, 0, time.UTC), res.Executions[0].ExecutedAt)

	// Unknown or empty source zones keep the legacy UTC interpretation.
	res = NewGeneric(mapping).WithSourceTZ("Not/AZone").ParseRows(row("2026-07-10 16:30:00"))
	require.Empty(t, res.Errors)
	require.Equal(t, time.Date(2026, 7, 10, 16, 30, 0, 0, time.UTC), res.Executions[0].ExecutedAt)
}
