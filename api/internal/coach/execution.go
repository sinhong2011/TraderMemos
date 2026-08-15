package coach

import (
	"fmt"
	"strings"
)

// ExecutionContext is this trade's execution-quality breakdown, on the same
// 0–100 axes the reports page shows. A nil axis lacks its inputs and is left
// out of the brief entirely rather than sent as a zero the model would read
// as a failing grade.
type ExecutionContext struct {
	Entry *float64
	Exit  *float64
	Risk  *float64
	Tempo *float64

	QuickReentry    bool
	Overtraded      bool
	RiskRecorded    bool
	OverMaxRisk     bool
	DailyLossBreach bool
	RulesConfigured bool
}

// scored reports whether anything is worth rendering.
func (e ExecutionContext) scored() bool {
	return e.Entry != nil || e.Exit != nil || e.Risk != nil || e.Tempo != nil
}

// format renders the execution block appended to the trade brief. Each axis
// carries its own definition — the model has no other way to know what "entry
// 75" measures, and an unexplained number invites invented reasoning.
func (e ExecutionContext) format() string {
	if !e.scored() {
		return ""
	}
	var b strings.Builder
	b.WriteString("\nExecution quality for this trade (0-100, from your own recorded data):\n")
	if e.Entry != nil {
		fmt.Fprintf(&b, "Entry %g/100 — how little heat the entry took before the trade worked "+
			"(MAE against MAE+MFE); low means you were early or chasing.\n", *e.Entry)
	}
	if e.Exit != nil {
		fmt.Fprintf(&b, "Exit %g/100 — share of the peak open profit actually kept "+
			"(net against MFE); low means you gave back the move.\n", *e.Exit)
	}
	if e.Risk != nil {
		fmt.Fprintf(&b, "Risk discipline %g/100 — whether risk was defined before the trade%s.\n",
			*e.Risk, riskBasis(e.RulesConfigured))
	}
	if e.Tempo != nil {
		fmt.Fprintf(&b, "Tempo %g/100 — frequency judged against your own median day; "+
			"0 means this trade was a quick re-entry or came on an overtraded day.\n", *e.Tempo)
	}

	if reasons := e.reasons(); len(reasons) > 0 {
		fmt.Fprintf(&b, "Why: %s.\n", strings.Join(reasons, "; "))
	}
	return b.String()
}

func riskBasis(rulesConfigured bool) string {
	if rulesConfigured {
		return " and whether it stayed inside your configured risk rules"
	}
	return " (no risk rules are configured, so only definition is scored)"
}

// reasons lists the specific findings behind a docked axis, so feedback can
// name the behaviour instead of restating the score.
func (e ExecutionContext) reasons() []string {
	var out []string
	if e.QuickReentry {
		out = append(out, "re-entered the same symbol within the quick re-entry window")
	}
	if e.Overtraded {
		out = append(out, "taken on a day with far more trades than your median")
	}
	if !e.RiskRecorded {
		out = append(out, "no initial risk was recorded before the trade")
	}
	if e.OverMaxRisk {
		out = append(out, "risk exceeded your configured max risk per trade")
	}
	if e.DailyLossBreach {
		out = append(out, "this trade's day breached your daily loss limit")
	}
	return out
}
