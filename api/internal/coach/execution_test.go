package coach

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func f(v float64) *float64 { return &v }

func TestExecutionContextFormat(t *testing.T) {
	out := ExecutionContext{
		Entry: f(75), Exit: f(40), Risk: f(50), Tempo: f(0),
		QuickReentry: true, RiskRecorded: true,
		OverMaxRisk: true, RulesConfigured: true,
	}.format()

	for _, want := range []string{
		"Entry 75/100",
		"Exit 40/100",
		"Risk discipline 50/100",
		"Tempo 0/100",
		"re-entered the same symbol",
		"risk exceeded your configured max risk per trade",
	} {
		require.Contains(t, out, want)
	}
}

// An axis with no inputs is omitted rather than rendered as 0 — a zero would
// read as a failing grade the data does not support.
func TestExecutionContextOmitsUnscoredAxes(t *testing.T) {
	out := ExecutionContext{Risk: f(100), Tempo: f(100), RiskRecorded: true}.format()

	require.NotContains(t, out, "Entry")
	require.NotContains(t, out, "Exit")
	require.Contains(t, out, "Risk discipline 100/100")
}

func TestExecutionContextEmptyRendersNothing(t *testing.T) {
	require.Empty(t, ExecutionContext{}.format())
}

func TestExecutionContextRiskBasisReflectsRules(t *testing.T) {
	withRules := ExecutionContext{Risk: f(50), RulesConfigured: true}.format()
	require.Contains(t, withRules, "inside your configured risk rules")

	without := ExecutionContext{Risk: f(100), RiskRecorded: true}.format()
	require.Contains(t, without, "no risk rules are configured")
}

func TestExecutionContextReasonsListedOnlyWhenTrue(t *testing.T) {
	clean := ExecutionContext{Entry: f(90), Risk: f(100), Tempo: f(100), RiskRecorded: true}.format()
	require.NotContains(t, clean, "Why:")

	flagged := ExecutionContext{Tempo: f(0), Overtraded: true, RiskRecorded: true, Risk: f(100)}.format()
	require.Contains(t, flagged, "far more trades than your median")
}

func TestFormatTradeContextIncludesExecution(t *testing.T) {
	exec := ExecutionContext{Entry: f(75), Exit: f(40), RiskRecorded: true}
	out := FormatTradeContext(TradeContext{
		Symbol:    "AAPL",
		Status:    "closed",
		OpenedAt:  time.Date(2026, 7, 1, 14, 0, 0, 0, time.UTC),
		Execution: &exec,
	})

	require.Contains(t, out, "Execution quality for this trade")
	require.Contains(t, out, "Entry 75/100")
}

func TestFormatTradeContextOmitsExecutionWhenNil(t *testing.T) {
	out := FormatTradeContext(TradeContext{
		Symbol: "AAPL", Status: "closed",
		OpenedAt: time.Date(2026, 7, 1, 14, 0, 0, 0, time.UTC),
	})
	require.NotContains(t, out, "Execution quality for this trade")
}
