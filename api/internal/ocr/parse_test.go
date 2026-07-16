package ocr

import "testing"

func TestParseTradeText_labeledFill(t *testing.T) {
	raw := `
Order Filled
Symbol: AAPL
Side: BUY
Quantity: 10
Price: 185.50
Commission: 1.00
Fee: 0.50
Time: 2024-01-15 10:30:00
`
	out := ParseTradeText(raw)
	if out.Symbol != "AAPL" {
		t.Fatalf("symbol: got %q", out.Symbol)
	}
	if out.Side != "long" {
		t.Fatalf("side: got %q", out.Side)
	}
	if out.InstrumentType != "stock" {
		t.Fatalf("instrument: got %q", out.InstrumentType)
	}
	if len(out.Rows) != 1 {
		t.Fatalf("rows: got %d warnings=%v", len(out.Rows), out.Warnings)
	}
	r := out.Rows[0]
	if r.Side != "buy" || r.Quantity != 10 || r.Price != 185.50 {
		t.Fatalf("row: %+v", r)
	}
	if r.Commission != 1 || r.Fees != 0.5 {
		t.Fatalf("fees/comm: %+v", r)
	}
	if r.ExecutedAt == "" {
		t.Fatalf("expected executed_at, got empty")
	}
	if out.Confidence < 0.7 {
		t.Fatalf("confidence too low: %v", out.Confidence)
	}
}

func TestParseTradeText_qtyAtPrice(t *testing.T) {
	raw := `TSLA SELL 5 @ 250.25 filled 01/15/2024 14:32`
	out := ParseTradeText(raw)
	if out.Symbol != "TSLA" {
		t.Fatalf("symbol: got %q", out.Symbol)
	}
	if len(out.Rows) != 1 {
		t.Fatalf("rows: %d warnings=%v raw rows empty conf=%v", len(out.Rows), out.Warnings, out.Confidence)
	}
	r := out.Rows[0]
	if r.Side != "sell" || r.Quantity != 5 || r.Price != 250.25 {
		t.Fatalf("row: %+v", r)
	}
	if out.Side != "short" {
		t.Fatalf("side: got %q", out.Side)
	}
}

func TestParseTradeText_futures(t *testing.T) {
	raw := `NQ BUY 2 @ 18500.25`
	out := ParseTradeText(raw)
	if out.Symbol != "NQ" {
		t.Fatalf("symbol: got %q", out.Symbol)
	}
	if out.InstrumentType != "future" {
		t.Fatalf("instrument: got %q", out.InstrumentType)
	}
}

func TestParseTradeText_empty(t *testing.T) {
	out := ParseTradeText("   ")
	if out.Confidence != 0 || len(out.Warnings) == 0 {
		t.Fatalf("expected empty extract, got %+v", out)
	}
}

func TestParseTradeText_euNumbers(t *testing.T) {
	raw := `Symbol: SAP
BUY
Quantity: 3
Price: 120,50
`
	out := ParseTradeText(raw)
	if len(out.Rows) != 1 {
		t.Fatalf("rows: %d", len(out.Rows))
	}
	if out.Rows[0].Price != 120.50 {
		t.Fatalf("price: got %v", out.Rows[0].Price)
	}
}
