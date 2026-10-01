package analytics

import (
	"math"
	"sort"

	"github.com/tradermemos/api/internal/money"
)

// Missed-trade outcomes, recorded after the fact.
const (
	MissedUnknown   = "unknown"
	MissedTarget    = "target"
	MissedStop      = "stop"
	MissedNoTrigger = "no_trigger"
)

// Why a setup was not taken; "" when not recorded.
const (
	MissedHesitated = "hesitated"
	MissedAway      = "away"
	MissedRules     = "rules"
	MissedOther     = "other"
)

// MissedPlan is the price plan behind a missed trade.
type MissedPlan struct {
	Direction string // "long" | "short"
	Entry     *float64
	Stop      *float64
	Target    *float64
}

// PlannedR is reward over risk for a full plan, or nil when a price is missing
// or the plan is not coherent for its direction (a long's stop must sit below
// entry and its target above; a short's the other way round).
func (p MissedPlan) PlannedR() *float64 {
	if p.Entry == nil || p.Stop == nil || p.Target == nil {
		return nil
	}
	e, s, t := *p.Entry, *p.Stop, *p.Target
	var risk, reward float64
	switch p.Direction {
	case "long":
		risk, reward = e-s, t-e
	case "short":
		risk, reward = s-e, e-t
	default:
		return nil
	}
	if risk <= 0 || reward <= 0 {
		return nil
	}
	r := money.Round2(reward / risk)
	return &r
}

// MissedR is what a miss would have made in R given its outcome: the planned R
// on a target hit, -1 on a stop, 0 when the entry never triggered. Nil when the
// outcome is unknown or a hit target has no full plan to price it.
func MissedR(outcome string, plannedR *float64) *float64 {
	var r float64
	switch outcome {
	case MissedTarget:
		if plannedR == nil {
			return nil
		}
		r = *plannedR
	case MissedStop:
		r = -1
	case MissedNoTrigger:
		r = 0
	default:
		return nil
	}
	return &r
}

// MissedTrade is the summary view of one logged miss.
type MissedTrade struct {
	Reason   string
	SetupID  string
	Outcome  string
	PlannedR *float64
}

// MissedGroup totals misses sharing a reason or setup.
type MissedGroup struct {
	Key   string  `json:"key"`
	Count int     `json:"count"`
	NetR  float64 `json:"net_r"`
	// Scored counts misses with a known R, the ones NetR is the sum of.
	Scored int `json:"scored"`
}

// MissedSummary is what the logged misses would have done, had they been taken.
type MissedSummary struct {
	Count    int            `json:"count"`
	Outcomes map[string]int `json:"outcomes"`
	Scored   int            `json:"scored"`
	RLeft    float64        `json:"r_left"`    // R the target hits would have made
	RAvoided float64        `json:"r_avoided"` // R the stop-outs would have cost (positive)
	NetR     float64        `json:"net_r"`     // RLeft - RAvoided
	AvgR     *float64       `json:"avg_r"`     // NetR per scored miss
	ByReason []MissedGroup  `json:"by_reason"` // largest |NetR| first
	BySetup  []MissedGroup  `json:"by_setup"`  // setups only; untagged misses omitted
	Unpriced int            `json:"unpriced"`  // target hits with no full plan
}

// SummarizeMissed totals a set of misses.
func SummarizeMissed(ms []MissedTrade) MissedSummary {
	out := MissedSummary{
		Outcomes: map[string]int{MissedUnknown: 0, MissedTarget: 0, MissedStop: 0, MissedNoTrigger: 0},
		ByReason: []MissedGroup{},
		BySetup:  []MissedGroup{},
	}
	reasons := map[string]*MissedGroup{}
	setups := map[string]*MissedGroup{}
	bump := func(groups map[string]*MissedGroup, key string, r *float64) {
		g := groups[key]
		if g == nil {
			g = &MissedGroup{Key: key}
			groups[key] = g
		}
		g.Count++
		if r != nil {
			g.Scored++
			g.NetR += *r
		}
	}
	for _, m := range ms {
		out.Count++
		outcome := m.Outcome
		if _, ok := out.Outcomes[outcome]; !ok {
			outcome = MissedUnknown
		}
		out.Outcomes[outcome]++
		r := MissedR(outcome, m.PlannedR)
		if outcome == MissedTarget && r == nil {
			out.Unpriced++
		}
		if r != nil {
			out.Scored++
			if *r > 0 {
				out.RLeft += *r
			} else {
				out.RAvoided -= *r
			}
		}
		bump(reasons, m.Reason, r)
		if m.SetupID != "" {
			bump(setups, m.SetupID, r)
		}
	}
	out.RLeft = money.Round2(out.RLeft)
	out.RAvoided = money.Round2(out.RAvoided)
	out.NetR = money.Round2(out.RLeft - out.RAvoided)
	if out.Scored > 0 {
		avg := money.Round2(out.NetR / float64(out.Scored))
		out.AvgR = &avg
	}
	out.ByReason = sortedGroups(reasons)
	out.BySetup = sortedGroups(setups)
	return out
}

func sortedGroups(groups map[string]*MissedGroup) []MissedGroup {
	out := make([]MissedGroup, 0, len(groups))
	for _, g := range groups {
		g.NetR = money.Round2(g.NetR)
		out = append(out, *g)
	}
	sort.Slice(out, func(i, j int) bool {
		if a, b := math.Abs(out[i].NetR), math.Abs(out[j].NetR); a != b {
			return a > b
		}
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Key < out[j].Key
	})
	return out
}
