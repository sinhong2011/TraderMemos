package system

import (
	"strings"
	"unicode"
)

// Decision identifiers — stable keys stored in version JSON and change log.
const (
	DecMarket      = "market"
	DecSelection   = "selection"
	DecSetup       = "setup"
	DecTrigger     = "trigger"
	DecRiskBudget  = "risk_budget"
	DecTradeRisk   = "trade_risk"
	DecPosition    = "position_size"
	DecPortfolio   = "portfolio"
	DecScaling     = "scaling"
	DecDefinition  = "definition"
	DecEvidence    = "evidence"
	DecDiagnosis   = "diagnosis"
	DecAction      = "action"
	DecMeasure     = "measure"
	DecReview      = "review"
	DecAdjust      = "adjust"
)

// Decisions is the fixed 16-decision order used by the blueprint and map.
var Decisions = []string{
	DecMarket, DecSelection, DecSetup, DecTrigger,
	DecRiskBudget, DecTradeRisk, DecPosition, DecPortfolio, DecScaling,
	DecDefinition, DecEvidence, DecDiagnosis, DecAction,
	DecMeasure, DecReview, DecAdjust,
}

const (
	PartEntry  = "entry"
	PartSizing = "sizing"
	PartExit   = "exit"
	PartReview = "review"
)

// PartOf returns the blueprint part for a decision.
func PartOf(d string) string {
	switch d {
	case DecMarket, DecSelection, DecSetup, DecTrigger:
		return PartEntry
	case DecRiskBudget, DecTradeRisk, DecPosition, DecPortfolio, DecScaling:
		return PartSizing
	case DecDefinition, DecEvidence, DecDiagnosis, DecAction:
		return PartExit
	default:
		return PartReview
	}
}

const (
	StanceNormal    = "normal"
	StanceDefensive = "defensive"
	StancePaused    = "paused"
)

var Stances = []string{StanceNormal, StanceDefensive, StancePaused}

func ValidStance(s string) bool {
	return s == StanceNormal || s == StanceDefensive || s == StancePaused
}

const (
	ExitWrong       = "wrong"
	ExitNotWorking  = "not_working"
	ExitFinished    = "finished"
	ExitOther       = "other"
	AdherenceFull   = "full"
	AdherencePartial = "partial"
	AdherenceNone   = "none"
	TriggerYes      = "yes"
	TriggerNo       = "no"
	TriggerNA       = "n.a."
)

var (
	ExitStates  = []string{ExitWrong, ExitNotWorking, ExitFinished, ExitOther}
	Adherences  = []string{AdherenceFull, AdherencePartial, AdherenceNone}
	Triggers    = []string{TriggerYes, TriggerNo, TriggerNA, ""}
	ChangeReasons = []string{"execution", "regime", "risk", "other"}
)

// Rule is one decision's text and self-check.
type Rule struct {
	Text       string `json:"text"`
	Executable bool   `json:"executable"`
}

// Checklist items that propose an adherence value.
const (
	CheckPlannedEntry  = "planned_entry"
	CheckPresetExit    = "preset_exit"
	CheckRiskAsPlanned = "risk_as_planned"
	CheckExitByPlan    = "exit_by_plan"
	CheckNoManualEdits = "no_manual_edits"
)

var ChecklistItems = []string{
	CheckPlannedEntry, CheckPresetExit, CheckRiskAsPlanned, CheckExitByPlan, CheckNoManualEdits,
}

// SuggestAdherence maps the 5-item checklist to full / partial / none.
// Nil or empty answers are ignored; only answered items count.
func SuggestAdherence(checks map[string]bool) string {
	if len(checks) == 0 {
		return ""
	}
	yes, n := 0, 0
	for _, k := range ChecklistItems {
		v, ok := checks[k]
		if !ok {
			continue
		}
		n++
		if v {
			yes++
		}
	}
	if n == 0 {
		return ""
	}
	if yes == n {
		return AdherenceFull
	}
	if yes == 0 {
		return AdherenceNone
	}
	return AdherencePartial
}

// ExecutableCount returns how many of the 16 decisions are marked executable.
func ExecutableCount(rules map[string]Rule) int {
	n := 0
	for _, d := range Decisions {
		if rules[d].Executable {
			n++
		}
	}
	return n
}

// RulesClean returns true when every decision has non-empty text trimmed of space.
func RulesClean(rules map[string]Rule) bool {
	for _, d := range Decisions {
		if strings.TrimSpace(rules[d].Text) == "" {
			return false
		}
	}
	return true
}

// DefaultRegimes are the starting stance keys. Labels stay empty so the UI
// can show the translated default (Normal / Defensive / Paused) as a
// placeholder until the user picks a custom name.
func DefaultRegimes() map[string]string {
	return map[string]string{
		StanceNormal:    "",
		StanceDefensive: "",
		StancePaused:    "",
	}
}

// DefaultTradeTypes seed decision 10 labels.
func DefaultTradeTypes() map[string]string {
	return map[string]string{
		"momentum": "Momentum",
		"position": "Position",
	}
}

// HasLetter reports whether s contains a letter (used for empty-rule checks).
func HasLetter(s string) bool {
	for _, r := range s {
		if unicode.IsLetter(r) {
			return true
		}
	}
	return false
}
