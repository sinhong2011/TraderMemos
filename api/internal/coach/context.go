package coach

import (
	"fmt"
	"strings"
	"time"
)

// FillContext is one execution row for the coach prompt.
type FillContext struct {
	Side       string
	Quantity   float64
	Price      float64
	Fees       float64
	ExecutedAt time.Time
}

// TradeContext is the factual trade snapshot sent to the model.
type TradeContext struct {
	Symbol         string
	InstrumentType string
	Direction      string
	Status         string
	OpenedAt       time.Time
	ClosedAt       *time.Time
	QtyOpened      float64
	QtyRemaining   float64
	AvgEntry       float64
	AvgExit        *float64
	GrossPnl       *float64
	FeesTotal      float64
	NetPnl         *float64
	Currency       string
	ReturnPct      *float64
	HoldSecs       *int64
	InitialRisk    *float64
	TargetPrice    *float64
	StopPrice      *float64
	RMultiple      *float64
	Mae            *float64
	Mfe            *float64
	Emotion        string
	SetupName      string
	SetupGrade     *int64 // 1–5 confidence
	ExecGrade      *int64 // 1–5 trade quality
	Notes          string
	TagNames       []string
	Fills          []FillContext
	// Session is the trader's state as of OpenedAt. Nil when it could not be
	// reconstructed, so the brief omits the block instead of claiming a flat day.
	Session *SessionContext
	// Execution is this trade's execution-quality axes. Nil for an open trade
	// or when the axes could not be computed.
	Execution *ExecutionContext
}

// FormatTradeContext renders a plain-text brief for the LLM user message.
func FormatTradeContext(t TradeContext) string {
	var b strings.Builder
	b.WriteString("Trade review data:\n")
	fmt.Fprintf(&b, "Symbol: %s (%s) %s %s\n", t.Symbol, t.InstrumentType, t.Direction, t.Status)
	fmt.Fprintf(&b, "Opened: %s\n", t.OpenedAt.UTC().Format(time.RFC3339))
	if t.ClosedAt != nil {
		fmt.Fprintf(&b, "Closed: %s\n", t.ClosedAt.UTC().Format(time.RFC3339))
	}
	fmt.Fprintf(&b, "Qty opened: %g  remaining: %g\n", t.QtyOpened, t.QtyRemaining)
	fmt.Fprintf(&b, "Avg entry: %g", t.AvgEntry)
	if t.AvgExit != nil {
		fmt.Fprintf(&b, "  avg exit: %g", *t.AvgExit)
	}
	b.WriteByte('\n')
	if t.GrossPnl != nil {
		fmt.Fprintf(&b, "Gross P&L: %g %s\n", *t.GrossPnl, t.Currency)
	}
	fmt.Fprintf(&b, "Fees: %g %s\n", t.FeesTotal, t.Currency)
	if t.NetPnl != nil {
		fmt.Fprintf(&b, "Net P&L: %g %s\n", *t.NetPnl, t.Currency)
	}
	if t.ReturnPct != nil {
		fmt.Fprintf(&b, "Return %%: %g\n", *t.ReturnPct)
	}
	if t.HoldSecs != nil {
		fmt.Fprintf(&b, "Time in trade: %ds\n", *t.HoldSecs)
	}
	if t.InitialRisk != nil {
		fmt.Fprintf(&b, "Initial risk: %g\n", *t.InitialRisk)
	}
	if t.TargetPrice != nil {
		fmt.Fprintf(&b, "Target: %g\n", *t.TargetPrice)
	}
	if t.StopPrice != nil {
		fmt.Fprintf(&b, "Stop: %g\n", *t.StopPrice)
	}
	if t.RMultiple != nil {
		fmt.Fprintf(&b, "R-multiple: %g\n", *t.RMultiple)
	}
	if t.Mae != nil {
		fmt.Fprintf(&b, "MAE: %g\n", *t.Mae)
	}
	if t.Mfe != nil {
		fmt.Fprintf(&b, "MFE: %g\n", *t.Mfe)
	}
	if name := strings.TrimSpace(t.SetupName); name != "" {
		fmt.Fprintf(&b, "Setup: %s\n", name)
	}
	if t.SetupGrade != nil {
		fmt.Fprintf(&b, "Setup grade (1-5): %d\n", *t.SetupGrade)
	}
	if t.ExecGrade != nil {
		fmt.Fprintf(&b, "Execution grade (1-5): %d\n", *t.ExecGrade)
	}
	if e := strings.TrimSpace(t.Emotion); e != "" {
		fmt.Fprintf(&b, "Emotional state: %s\n", e)
	}
	if len(t.TagNames) > 0 {
		fmt.Fprintf(&b, "Tags: %s\n", strings.Join(t.TagNames, ", "))
	}
	if n := strings.TrimSpace(t.Notes); n != "" {
		fmt.Fprintf(&b, "Journal notes:\n%s\n", n)
	}
	if len(t.Fills) > 0 {
		b.WriteString("Fills:\n")
		for i, f := range t.Fills {
			fmt.Fprintf(&b, "  %d. %s %g @ %g fees=%g at %s\n",
				i+1, f.Side, f.Quantity, f.Price, f.Fees, f.ExecutedAt.UTC().Format(time.RFC3339))
		}
	}
	if t.Execution != nil {
		b.WriteString(t.Execution.format())
	}
	if t.Session != nil {
		b.WriteString(t.Session.format())
	}
	return b.String()
}
