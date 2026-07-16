package ocr

import "testing"

func TestParseIBKRTradeList_july07(t *testing.T) {
	raw := `
Orders & Trades
Jul 07, 2026 REALIZED P&L
7 Trade(s) $119.64
INTC miax $4.2 22:16:41
JUL 10 '26 110 Put $420 $73.53
Sold 1 $1.05
4.2 Limit, Day
INTC max $3.8 22:04:35
JUL 10 '26 110 Put $380 $33.53
Sold 1 $1.05
3.8 Limit, Day
INTC sapPHire $3.65 22:03:29
JUL 10 '26 110 Put $365 $18.8
Sold 1 $0.78
3.65 Limit, Day
INTC sapPHire $3.45 22:01:35
JUL 10 '26 110 Put $1,035
Bought 3 $1.25
3.45 Limit, Day
INTC sapPHire $3.2 21:59:52
JUL 10 '26 110 Put $640 -$6.22
Sold 2 $0.85
3.2 Limit, Day
INTC mercury $3.22 21:53:10
JUL 10 '26 110 Put $644
Bought 2 $1.37
3.22 Market, Day
`
	out := ParseTradeText(raw)
	if out.Symbol != "INTC" {
		t.Fatalf("symbol: got %q", out.Symbol)
	}
	if out.InstrumentType != "option" {
		t.Fatalf("instrument: got %q", out.InstrumentType)
	}
	if len(out.Rows) != 6 {
		t.Fatalf("rows: got %d want 6; warnings=%v", len(out.Rows), out.Warnings)
	}
	// Chronological OCR order is newest-first as shown on screen.
	want := []struct {
		side string
		qty  float64
		px   float64
		comm float64
	}{
		{"sell", 1, 4.2, 1.05},
		{"sell", 1, 3.8, 1.05},
		{"sell", 1, 3.65, 0.78},
		{"buy", 3, 3.45, 1.25},
		{"sell", 2, 3.2, 0.85},
		{"buy", 2, 3.22, 1.37},
	}
	for i, w := range want {
		r := out.Rows[i]
		if r.Side != w.side || r.Quantity != w.qty || r.Price != w.px {
			t.Fatalf("row %d: got %+v want side=%s qty=%v px=%v", i, r, w.side, w.qty, w.px)
		}
		if r.Commission != w.comm {
			t.Fatalf("row %d commission: got %v want %v", i, r.Commission, w.comm)
		}
		if r.ExecutedAt == "" {
			t.Fatalf("row %d missing executed_at", i)
		}
	}
	if out.Confidence < 0.7 {
		t.Fatalf("confidence too low: %v", out.Confidence)
	}
}

func TestCleanCommissionOCR(t *testing.T) {
	cases := map[string]float64{
		"1.05": 1.05,
		"91.05": 1.05,
		"30.78": 0.78,
		"0.85": 0.85,
		"2125": 0,
		"30.56": 0.56,
	}
	for in, want := range cases {
		got := cleanCommissionOCR(in)
		if got != want {
			t.Fatalf("%q: got %v want %v", in, got, want)
		}
	}
}
