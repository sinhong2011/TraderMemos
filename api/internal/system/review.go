package system

import (
	"math"
	"sort"
	"time"
)

// Sample-size bands. Below SampleIndicative a group says nothing; below
// SampleAdequate it only hints. Labels never claim a rule is proven.
const (
	SampleIndicative = 10
	SampleAdequate   = 30

	SampleThin  = "thin"
	SampleHint  = "indicative"
	SampleSolid = "adequate"
	streakWindow   = 50
	streakMinShown = 3
)

// Trade is one closed trade as the review sees it.
type Trade struct {
	ID        string
	OpenedAt  time.Time
	ClosedAt  time.Time
	NetPnl    float64
	R         *float64
	HoldSecs  int64
	Carded    bool
	Regime    string
	Adherence string
	ExitState string
	TradeType string
	VersionID string
	SetupID   string
	Trigger   string
	PlannedAhead *bool
}

// Stats are the measure numbers for a group of trades.
type Stats struct {
	Key          string   `json:"key"`
	Trades       int      `json:"trades"`
	Wins         int      `json:"wins"`
	Losses       int      `json:"losses"`
	WinRate      float64  `json:"win_rate"`
	AvgWin       float64  `json:"avg_win"`
	AvgLoss      float64  `json:"avg_loss"`
	ProfitFactor *float64 `json:"profit_factor"`
	NetPnl       float64  `json:"net_pnl"`
	ExpectancyR  *float64 `json:"expectancy_r"`
	AvgHoldSecs  float64  `json:"avg_hold_secs"`
	Sample       string   `json:"sample"`
}

// Cell is one quadrant cell.
type Cell struct {
	Trades int     `json:"trades"`
	NetPnl float64 `json:"net_pnl"`
	SumR   float64 `json:"sum_r"`
	HasR   int     `json:"has_r"`
}

// Quadrant is process (full vs not) × outcome (win vs loss).
type Quadrant struct {
	RightWin  Cell `json:"right_win"`
	RightLoss Cell `json:"right_loss"`
	WrongWin  Cell `json:"wrong_win"`
	WrongLoss Cell `json:"wrong_loss"`
}

// Coverage counts how much of the filtered set has system fields filled in.
type Coverage struct {
	Closed    int `json:"closed"`
	Carded    int `json:"carded"`
	Regime    int `json:"regime"`
	Adherence int `json:"adherence"`
	ExitState int `json:"exit_state"`
	Planned   int `json:"planned_ahead"`
}

// StreakCause is one candidate explanation for a losing run.
type StreakCause struct {
	Key     string  `json:"key"`
	Score   float64 `json:"score"`
	Detail  string  `json:"detail"`
	Suggest string  `json:"suggest"`
}

// Streak is the open or recent losing run diagnosis.
type Streak struct {
	Length int           `json:"length"`
	Chance float64       `json:"chance"`
	Causes []StreakCause `json:"causes"`
}

// Review is the phase-3 payload.
type Review struct {
	Coverage   Coverage `json:"coverage"`
	Quadrant   Quadrant `json:"quadrant"`
	ByRegime   []Stats  `json:"by_regime"`
	BySetup    []Stats  `json:"by_setup"`
	ByExit     []Stats  `json:"by_exit_state"`
	ByType     []Stats  `json:"by_trade_type"`
	ByVersion  []Stats  `json:"by_version"`
	ByAdhere   []Stats  `json:"by_adherence"`
	Streak     *Streak  `json:"streak"`
}

func sampleBand(n int) string {
	if n < SampleIndicative {
		return SampleThin
	}
	if n < SampleAdequate {
		return SampleHint
	}
	return SampleSolid
}

func addCell(c *Cell, t Trade) {
	c.Trades++
	c.NetPnl += t.NetPnl
	if t.R != nil {
		c.SumR += *t.R
		c.HasR++
	}
}

// Compute builds the review from closed trades already filtered by the handler.
func Compute(trades []Trade) Review {
	var out Review
	out.Coverage.Closed = len(trades)
	groups := map[string]map[string][]Trade{
		"regime":     {},
		"setup":      {},
		"exit":       {},
		"type":       {},
		"version":    {},
		"adherence":  {},
	}
	for _, t := range trades {
		if t.Carded {
			out.Coverage.Carded++
		}
		if t.Regime != "" {
			out.Coverage.Regime++
		}
		if t.Adherence != "" {
			out.Coverage.Adherence++
		}
		if t.ExitState != "" {
			out.Coverage.ExitState++
		}
		if t.PlannedAhead != nil && *t.PlannedAhead {
			out.Coverage.Planned++
		}
		if t.Adherence == AdherenceFull {
			if t.NetPnl >= 0 {
				addCell(&out.Quadrant.RightWin, t)
			} else {
				addCell(&out.Quadrant.RightLoss, t)
			}
		} else if t.Adherence == AdherencePartial || t.Adherence == AdherenceNone {
			if t.NetPnl >= 0 {
				addCell(&out.Quadrant.WrongWin, t)
			} else {
				addCell(&out.Quadrant.WrongLoss, t)
			}
		}
		put := func(kind, key string) {
			if key == "" {
				key = "(none)"
			}
			groups[kind][key] = append(groups[kind][key], t)
		}
		put("regime", t.Regime)
		put("setup", t.SetupID)
		put("exit", t.ExitState)
		put("type", t.TradeType)
		put("version", t.VersionID)
		put("adherence", t.Adherence)
	}
	out.ByRegime = statsOf(groups["regime"])
	out.BySetup = statsOf(groups["setup"])
	out.ByExit = statsOf(groups["exit"])
	out.ByType = statsOf(groups["type"])
	out.ByVersion = statsOf(groups["version"])
	out.ByAdhere = statsOf(groups["adherence"])
	out.Streak = diagnoseStreak(trades)
	return out
}

func statsOf(m map[string][]Trade) []Stats {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]Stats, 0, len(keys))
	for _, k := range keys {
		out = append(out, groupStats(k, m[k]))
	}
	return out
}

func groupStats(key string, ts []Trade) Stats {
	s := Stats{Key: key, Trades: len(ts), Sample: sampleBand(len(ts))}
	var winSum, lossSum, holdSum float64
	var rSum float64
	var rN int
	for _, t := range ts {
		holdSum += float64(t.HoldSecs)
		if t.NetPnl > 0 {
			s.Wins++
			winSum += t.NetPnl
		} else if t.NetPnl < 0 {
			s.Losses++
			lossSum += -t.NetPnl
		}
		s.NetPnl += t.NetPnl
		if t.R != nil {
			rSum += *t.R
			rN++
		}
	}
	if s.Trades > 0 {
		s.WinRate = float64(s.Wins) / float64(s.Trades)
		s.AvgHoldSecs = holdSum / float64(s.Trades)
	}
	if s.Wins > 0 {
		s.AvgWin = winSum / float64(s.Wins)
	}
	if s.Losses > 0 {
		s.AvgLoss = lossSum / float64(s.Losses)
	}
	if lossSum > 0 {
		pf := winSum / lossSum
		s.ProfitFactor = &pf
	}
	// No losses with wins → leave profit_factor nil (JSON can't encode +Inf).
	if rN > 0 {
		e := rSum / float64(rN)
		s.ExpectancyR = &e
	}
	return s
}

func diagnoseStreak(trades []Trade) *Streak {
	if len(trades) == 0 {
		return nil
	}
	sorted := append([]Trade(nil), trades...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].ClosedAt.Equal(sorted[j].ClosedAt) {
			return sorted[i].ID < sorted[j].ID
		}
		return sorted[i].ClosedAt.After(sorted[j].ClosedAt)
	})
	if len(sorted) > streakWindow {
		sorted = sorted[:streakWindow]
	}
	run := 0
	for _, t := range sorted {
		if t.NetPnl < 0 {
			run++
			continue
		}
		break
	}
	if run < streakMinShown {
		return nil
	}
	// Win rate over the window excluding the open streak tip for a fair prior.
	wins, n := 0, 0
	for i := run; i < len(sorted); i++ {
		n++
		if sorted[i].NetPnl > 0 {
			wins++
		}
	}
	p := 0.5
	if n > 0 {
		p = float64(wins) / float64(n)
		if p < 0.05 {
			p = 0.05
		}
		if p > 0.95 {
			p = 0.95
		}
	}
	chance := math.Pow(1-p, float64(run))

	streak := sorted[:run]
	execBad, trigMiss, paused := 0, 0, 0
	for _, t := range streak {
		if t.Adherence == AdherencePartial || t.Adherence == AdherenceNone {
			execBad++
		}
		if t.Trigger == TriggerNo {
			trigMiss++
		}
		// Only Paused counts as a regime cause — Defensive still allows trading.
		if t.Regime == StancePaused {
			paused++
		}
	}
	causes := []StreakCause{
		{
			Key: "variance", Score: chance,
			Detail:  "chance of this streak given recent win rate",
			Suggest: "If chance is not tiny, treat it as normal variance — do not rewrite rules yet.",
		},
		{
			Key: "execution", Score: frac(execBad, run),
			Detail:  "share of streak trades with partial/none adherence",
			Suggest: "Rules were not followed. Fix the process, not the rules.",
		},
		{
			Key: "selection", Score: frac(trigMiss, run),
			Detail:  "share taken without the trigger",
			Suggest: "Tighten selection and trigger discipline.",
		},
		{
			Key: "regime", Score: frac(paused, run),
			Detail:  "share taken while market was paused",
			Suggest: "Stand aside in paused markets; Defensive still allows smaller trading.",
		},
	}
	sort.SliceStable(causes, func(i, j int) bool { return causes[i].Score > causes[j].Score })
	return &Streak{Length: run, Chance: chance, Causes: causes}
}

func frac(a, b int) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}
