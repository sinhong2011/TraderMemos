package system

// PlanTarget is how many carded trades the test and live weeks ask for —
// enough to surface ambiguous or missing rules, not to prove an edge.
const PlanTarget = 10

// PlanInput is what the four-week plan reads.
type PlanInput struct {
	// Executable is the decision count marked executable on the active
	// version, or on the draft while nothing is active yet.
	Executable int
	// Activated is how many versions have ever been activated.
	Activated int
	// HistoryTrades are carded closed trades tested against the rules after
	// the fact: opened before the first activation, or in a backtest account.
	HistoryTrades int
	// LiveTrades are carded closed live trades opened under an active version.
	// Progress only means "ran it live with a card" — there is no size/risk
	// check, so this is not a small-size verification.
	LiveTrades int
}

// Step is one week of the plan.
type Step struct {
	Week     int    `json:"week"`
	Key      string `json:"key"`
	Progress int    `json:"progress"`
	Target   int    `json:"target"`
	Done     bool   `json:"done"`
}

// Plan scores the four weeks: write v1.0, test on past trades, run it live
// (follow-ability), then revise by activating the next version.
//
// Week 4 is a revision after the write, the history test, and a live run.
// Activating a second version while those are still open does not finish it.
// Saved review decisions land in a later stage.
func Plan(in PlanInput) []Step {
	clamp := func(v, hi int) int { return max(0, min(v, hi)) }
	steps := []Step{
		{Week: 1, Key: "write", Progress: clamp(in.Executable, len(Decisions)), Target: len(Decisions)},
		{Week: 2, Key: "test", Progress: clamp(in.HistoryTrades, PlanTarget), Target: PlanTarget},
		{Week: 3, Key: "live", Progress: clamp(in.LiveTrades, PlanTarget), Target: PlanTarget},
		// Progress: how many revisions after the first activation (Activated-1).
		{Week: 4, Key: "revise", Progress: clamp(in.Activated-1, 1), Target: 1},
	}
	steps[0].Done = in.Activated > 0 && steps[0].Progress == steps[0].Target
	for i := 1; i <= 2; i++ {
		steps[i].Done = steps[i].Progress >= steps[i].Target
	}
	steps[3].Done = steps[3].Progress >= steps[3].Target && steps[0].Done && steps[1].Done && steps[2].Done
	return steps
}
