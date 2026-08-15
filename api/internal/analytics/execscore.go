package analytics

import (
	"math"
	"sort"
	"time"
)

// ScoreTrade is the per-trade view needed to score execution quality.
type ScoreTrade struct {
	ID          string
	Symbol      string
	NetPnl      float64
	OpenedAt    time.Time
	ClosedAt    time.Time
	InitialRisk float64  // 0 = not recorded
	Mae         *float64 // positive magnitude; nil = not recorded
	Mfe         *float64 // positive magnitude; nil = not recorded
}

// ExecScoreConfig tunes the composite. DefaultExecScoreConfig is the only
// configuration in use today; the type exists so thresholds and weights can
// become per-user settings without touching the scoring code.
type ExecScoreConfig struct {
	QuickReentryWindow time.Duration // same-symbol re-entry gap that flags tempo
	OvertradeFactor    float64       // day count ÷ median daily count that flags the day
	MinTempoDays       int           // fewer trading days → overtrading is not judged
	MinTrades          int           // fewer scored inputs → aggregate axis undefined
	MinBucketTrades    int           // fewer scored inputs → series-bucket axis undefined
	// Axis weights for the composite; renormalized over defined axes.
	WeightEntry     float64
	WeightExit      float64
	WeightRisk      float64
	WeightStability float64
	WeightTempo     float64
	// StabilitySlope is the per-trade mean/stddev ratio that saturates the
	// stability axis: score = 50 + 50·ratio/slope, clamped to 0–100.
	StabilitySlope float64
}

func DefaultExecScoreConfig() ExecScoreConfig {
	return ExecScoreConfig{
		QuickReentryWindow: 15 * time.Minute,
		OvertradeFactor:    2.0,
		MinTempoDays:       3,
		MinTrades:          5,
		MinBucketTrades:    3,
		WeightEntry:        0.25,
		WeightExit:         0.25,
		WeightRisk:         0.2,
		WeightStability:    0.2,
		WeightTempo:        0.1,
		StabilitySlope:     0.6,
	}
}

// AxisScore is one axis of the composite. Score is nil — not zero — when too
// few trades carry the inputs, so the UI can say "insufficient data" instead
// of rendering a fake 0 (or a radar pinned at 50).
type AxisScore struct {
	Score    *float64 `json:"score"`    // 0–100
	Scored   int      `json:"scored"`   // trades that informed the axis
	Excluded int      `json:"excluded"` // trades missing the inputs
}

// ExecScorePoint is one series bucket for the per-axis drill-down.
type ExecScorePoint struct {
	Date      string   `json:"date"` // bucket start, YYYY-MM-DD in the trader's timezone
	Trades    int      `json:"trades"`
	Composite *float64 `json:"composite"`
	Entry     *float64 `json:"entry"`
	Exit      *float64 `json:"exit"`
	Risk      *float64 `json:"risk"`
	Stability *float64 `json:"stability"`
	Tempo     *float64 `json:"tempo"`
}

// ExecScoreReport is the payload for GET /analytics/execution-score.
type ExecScoreReport struct {
	Trades          int              `json:"trades"`
	RulesConfigured bool             `json:"rules_configured"`
	Bucket          string           `json:"bucket"` // week | month
	Composite       *float64         `json:"composite"`
	Entry           AxisScore        `json:"entry"`
	Exit            AxisScore        `json:"exit"`
	Risk            AxisScore        `json:"risk"`
	Stability       AxisScore        `json:"stability"`
	Tempo           AxisScore        `json:"tempo"`
	Series          []ExecScorePoint `json:"series"`
}

// scoredTrade carries the per-trade axis fractions (0–1) alongside the trade.
// A nil fraction means the trade lacks that axis's inputs.
type scoredTrade struct {
	t         ScoreTrade
	entry     *float64
	exit      *float64
	risk      *float64
	tempo     *float64
	stabValue *float64 // R multiple when risk is recorded, else net P&L
	stabIsR   bool

	// Why the risk and tempo axes scored as they did, kept so a single trade
	// can be explained and not merely numbered.
	quickReentry bool
	overtraded   bool
	riskRecorded bool
	overMaxRisk  bool
	lossBreach   bool
}

// ExecScore computes the execution-quality composite over closed trades.
//
// Axes (each 0–100):
//   - Entry: 1 − MAE/(MAE+MFE) — how little heat the entry took relative to
//     the favorable move it found. Needs recorded MAE and MFE.
//   - Exit: net ÷ MFE — how much of the peak open profit was kept. Only
//     trades that were green at some point (MFE > 0) are scored; a trade
//     that never worked is an entry problem, not an exit one.
//   - Risk: discipline (risk recorded before the trade) blended with rule
//     compliance (per-trade max risk, intraday daily-loss breaches) when
//     rules are configured; discipline alone otherwise, so the axis never
//     pins at a constant when rules are absent.
//   - Stability: mean ÷ stddev of per-trade R multiples (falling back to net
//     P&L when too few trades carry risk), mapped linearly around 50 and
//     saturating at ±StabilitySlope.
//   - Tempo: share of trades that were neither same-symbol quick re-entries
//     nor part of a day trading OvertradeFactor× the trader's own median
//     daily count — frequency judged against the trader's own baseline.
//
// The composite is the weighted mean of the defined axes with weights
// renormalized, so a missing axis widens the others instead of dragging the
// score toward zero.
func ExecScore(trades []ScoreTrade, rules ComplianceRules, cfg ExecScoreConfig, loc *time.Location, bucket string) ExecScoreReport {
	if loc == nil {
		loc = time.UTC
	}
	if bucket != "month" {
		bucket = "week"
	}
	rep := ExecScoreReport{
		Trades:          len(trades),
		RulesConfigured: rules.configured(),
		Bucket:          bucket,
		Series:          []ExecScorePoint{},
	}
	if len(trades) == 0 {
		return rep
	}

	sorted := make([]ScoreTrade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })

	sctx := newScoringContext(sorted, rules, cfg, loc)
	scored := make([]scoredTrade, 0, len(sorted))
	for _, t := range sorted {
		scored = append(scored, sctx.score(t))
	}

	rep.Entry, rep.Exit, rep.Risk, rep.Stability, rep.Tempo = axesOf(scored, cfg, cfg.MinTrades)
	rep.Composite = composite(cfg, rep.Entry.Score, rep.Exit.Score, rep.Risk.Score, rep.Stability.Score, rep.Tempo.Score)

	byBucket := map[string][]scoredTrade{}
	var order []string
	for _, st := range scored {
		key := bucketStart(st.t.ClosedAt.In(loc), bucket)
		if _, ok := byBucket[key]; !ok {
			order = append(order, key)
		}
		byBucket[key] = append(byBucket[key], st)
	}
	sort.Strings(order)
	for _, key := range order {
		group := byBucket[key]
		entry, exit, risk, stab, tempo := axesOf(group, cfg, cfg.MinBucketTrades)
		p := ExecScorePoint{
			Date:      key,
			Trades:    len(group),
			Entry:     entry.Score,
			Exit:      exit.Score,
			Risk:      risk.Score,
			Stability: stab.Score,
			Tempo:     tempo.Score,
		}
		p.Composite = composite(cfg, p.Entry, p.Exit, p.Risk, p.Stability, p.Tempo)
		rep.Series = append(rep.Series, p)
	}
	return rep
}

// scoringContext holds the cross-trade facts a single trade's axes depend on:
// which days breached the daily-loss rule, which trades were quick re-entries,
// and which days the trader traded well above their own median count.
type scoringContext struct {
	rules           ComplianceRules
	rulesConfigured bool
	breachDays      map[string]bool
	quick           map[string]bool
	overDays        map[string]bool
	loc             *time.Location
}

func newScoringContext(
	sorted []ScoreTrade,
	rules ComplianceRules,
	cfg ExecScoreConfig,
	loc *time.Location,
) scoringContext {
	return scoringContext{
		rules:           rules,
		rulesConfigured: rules.configured(),
		breachDays:      dailyLossBreachDays(sorted, rules, loc),
		quick:           quickReentries(sorted, cfg.QuickReentryWindow),
		overDays:        overtradedDays(sorted, cfg, loc),
		loc:             loc,
	}
}

// score computes one trade's axis fractions and records why each was docked.
// ExecScore and TradeAxesFor both go through here so the per-trade numbers the
// coach cites can never drift from the ones the reports page aggregates.
func (sc scoringContext) score(t ScoreTrade) scoredTrade {
	st := scoredTrade{t: t}

	if t.Mae != nil && t.Mfe != nil {
		heat := math.Max(*t.Mae, 0)
		move := math.Max(*t.Mfe, 0)
		if heat+move > 0 {
			v := 1 - heat/(heat+move)
			st.entry = &v
		}
	}

	if t.Mfe != nil && *t.Mfe > 0 {
		v := clamp01(t.NetPnl / *t.Mfe)
		st.exit = &v
	}

	st.riskRecorded = t.InitialRisk > 0
	day := t.ClosedAt.In(sc.loc).Format("2006-01-02")
	if sc.rulesConfigured {
		st.overMaxRisk = sc.rules.MaxRiskPerTrade > 0 &&
			st.riskRecorded && t.InitialRisk > sc.rules.MaxRiskPerTrade
		st.lossBreach = sc.breachDays[day]
		compliant := 1.0
		if st.overMaxRisk || st.lossBreach {
			compliant = 0
		}
		v := 0.5*b2f(st.riskRecorded) + 0.5*compliant
		st.risk = &v
	} else {
		v := b2f(st.riskRecorded)
		st.risk = &v
	}

	st.quickReentry = sc.quick[t.ID]
	st.overtraded = sc.overDays[t.OpenedAt.In(sc.loc).Format("2006-01-02")]
	tempo := 1.0
	if st.quickReentry || st.overtraded {
		tempo = 0
	}
	st.tempo = &tempo

	if st.riskRecorded {
		v := t.NetPnl / t.InitialRisk
		st.stabValue = &v
		st.stabIsR = true
	}
	return st
}

// TradeAxes is one trade's execution quality, 0–100 per axis. A nil score
// means the trade lacks that axis's inputs — never a zero, matching how
// AxisScore reports "insufficient data" rather than a fake score.
//
// Stability is deliberately absent: it is the dispersion of results across
// trades and is undefined for a single one.
type TradeAxes struct {
	Entry *float64 `json:"entry"`
	Exit  *float64 `json:"exit"`
	Risk  *float64 `json:"risk"`
	Tempo *float64 `json:"tempo"`

	// Why an axis scored as it did. A bare number tells a coach nothing
	// actionable; "you re-entered the same symbol within 15 minutes" does.
	QuickReentry    bool `json:"quick_reentry"`
	Overtraded      bool `json:"overtraded"`
	RiskRecorded    bool `json:"risk_recorded"`
	OverMaxRisk     bool `json:"over_max_risk"`
	DailyLossBreach bool `json:"daily_loss_breach"`
	RulesConfigured bool `json:"rules_configured"`
}

// TradeAxesFor scores one trade within the context of the trader's own
// history — tempo and daily-loss compliance are only meaningful relative to
// the other trades, so the full set must be passed in even to score one.
//
// Reports false when tradeID is not among trades.
func TradeAxesFor(
	tradeID string,
	trades []ScoreTrade,
	rules ComplianceRules,
	cfg ExecScoreConfig,
	loc *time.Location,
) (TradeAxes, bool) {
	if loc == nil {
		loc = time.UTC
	}
	sorted := make([]ScoreTrade, len(trades))
	copy(sorted, trades)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].ClosedAt.Before(sorted[j].ClosedAt) })

	idx := -1
	for i, t := range sorted {
		if t.ID == tradeID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return TradeAxes{}, false
	}

	st := newScoringContext(sorted, rules, cfg, loc).score(sorted[idx])
	return TradeAxes{
		Entry:           pct(st.entry),
		Exit:            pct(st.exit),
		Risk:            pct(st.risk),
		Tempo:           pct(st.tempo),
		QuickReentry:    st.quickReentry,
		Overtraded:      st.overtraded,
		RiskRecorded:    st.riskRecorded,
		OverMaxRisk:     st.overMaxRisk,
		DailyLossBreach: st.lossBreach,
		RulesConfigured: rules.configured(),
	}, true
}

// pct rescales a 0–1 axis fraction to the 0–100 the axes are reported in.
func pct(v *float64) *float64 {
	if v == nil {
		return nil
	}
	s := round1(100 * *v)
	return &s
}

// axesOf aggregates per-trade fractions into 0–100 axis scores, leaving an
// axis undefined below minScored inputs.
func axesOf(group []scoredTrade, cfg ExecScoreConfig, minScored int) (entry, exit, risk, stability, tempo AxisScore) {
	entry = meanAxis(group, minScored, func(st scoredTrade) *float64 { return st.entry })
	exit = meanAxis(group, minScored, func(st scoredTrade) *float64 { return st.exit })
	risk = meanAxis(group, minScored, func(st scoredTrade) *float64 { return st.risk })
	tempo = meanAxis(group, minScored, func(st scoredTrade) *float64 { return st.tempo })
	stability = stabilityAxis(group, cfg, minScored)
	return
}

func meanAxis(group []scoredTrade, minScored int, pick func(scoredTrade) *float64) AxisScore {
	var sum float64
	ax := AxisScore{}
	for _, st := range group {
		v := pick(st)
		if v == nil {
			ax.Excluded++
			continue
		}
		ax.Scored++
		sum += *v
	}
	if ax.Scored >= minScored {
		s := round1(100 * sum / float64(ax.Scored))
		ax.Score = &s
	}
	return ax
}

// stabilityAxis prefers R multiples (comparable across position sizes); when
// too few trades carry recorded risk it falls back to raw net P&L over the
// whole group so the axis still reflects result consistency.
func stabilityAxis(group []scoredTrade, cfg ExecScoreConfig, minScored int) AxisScore {
	var rvals, pnls []float64
	for _, st := range group {
		if st.stabIsR {
			rvals = append(rvals, *st.stabValue)
		}
		pnls = append(pnls, st.t.NetPnl)
	}
	vals := rvals
	excluded := len(group) - len(rvals)
	if len(rvals) < minScored {
		vals = pnls
		excluded = 0
	}
	ax := AxisScore{Scored: len(vals), Excluded: excluded}
	if len(vals) < minScored || len(vals) < 2 {
		ax.Scored = 0
		ax.Excluded = len(group)
		return ax
	}
	sd := sampleStddev(vals)
	if sd == 0 {
		// Identical results are perfectly stable but carry no information
		// about dispersion; report undefined rather than a fake 100.
		ax.Scored = 0
		ax.Excluded = len(group)
		return ax
	}
	var sum float64
	for _, v := range vals {
		sum += v
	}
	ratio := (sum / float64(len(vals))) / sd
	s := round1(100 * clamp01(0.5+ratio/(2*cfg.StabilitySlope)))
	ax.Score = &s
	return ax
}

func composite(cfg ExecScoreConfig, entry, exit, risk, stability, tempo *float64) *float64 {
	var sum, wsum float64
	add := func(score *float64, w float64) {
		if score != nil {
			sum += *score * w
			wsum += w
		}
	}
	add(entry, cfg.WeightEntry)
	add(exit, cfg.WeightExit)
	add(risk, cfg.WeightRisk)
	add(stability, cfg.WeightStability)
	add(tempo, cfg.WeightTempo)
	if wsum == 0 {
		return nil
	}
	v := round1(sum / wsum)
	return &v
}

// dailyLossBreachDays mirrors Compliance's rule: a day breaches when its
// running realized P&L (trades in close order) dips below −MaxDailyLoss at
// any point, even if the day finishes green.
func dailyLossBreachDays(sorted []ScoreTrade, rules ComplianceRules, loc *time.Location) map[string]bool {
	out := map[string]bool{}
	if rules.MaxDailyLoss <= 0 {
		return out
	}
	running := map[string]float64{}
	for _, t := range sorted {
		day := t.ClosedAt.In(loc).Format("2006-01-02")
		running[day] += t.NetPnl
		if running[day] < -rules.MaxDailyLoss {
			out[day] = true
		}
	}
	return out
}

// quickReentries flags trades opened within window of any prior same-symbol
// close (the tempo half of the behavior detector's quick-re-entry rule).
func quickReentries(sorted []ScoreTrade, window time.Duration) map[string]bool {
	out := map[string]bool{}
	if window <= 0 {
		return out
	}
	byOpen := make([]ScoreTrade, len(sorted))
	copy(byOpen, sorted)
	sort.SliceStable(byOpen, func(i, j int) bool { return byOpen[i].OpenedAt.Before(byOpen[j].OpenedAt) })
	lastClose := map[string]time.Time{}
	for _, t := range byOpen {
		if prev, ok := lastClose[t.Symbol]; ok {
			gap := t.OpenedAt.Sub(prev)
			if gap >= 0 && gap <= window {
				out[t.ID] = true
			}
		}
		if cur, ok := lastClose[t.Symbol]; !ok || t.ClosedAt.After(cur) {
			lastClose[t.Symbol] = t.ClosedAt
		}
	}
	return out
}

// overtradedDays flags calendar days (keyed on open time) whose trade count
// exceeds OvertradeFactor× the trader's own median daily count. With fewer
// than MinTempoDays trading days there is no baseline to judge against.
func overtradedDays(sorted []ScoreTrade, cfg ExecScoreConfig, loc *time.Location) map[string]bool {
	out := map[string]bool{}
	counts := map[string]int{}
	for _, t := range sorted {
		counts[t.OpenedAt.In(loc).Format("2006-01-02")]++
	}
	if len(counts) < cfg.MinTempoDays || cfg.OvertradeFactor <= 0 {
		return out
	}
	daily := make([]float64, 0, len(counts))
	for _, n := range counts {
		daily = append(daily, float64(n))
	}
	baseline := median(daily)
	if baseline <= 0 {
		return out
	}
	for day, n := range counts {
		if float64(n) > cfg.OvertradeFactor*baseline {
			out[day] = true
		}
	}
	return out
}

// bucketStart formats the series key: Monday of the ISO week, or the first of
// the month.
func bucketStart(at time.Time, bucket string) string {
	if bucket == "month" {
		return time.Date(at.Year(), at.Month(), 1, 0, 0, 0, 0, at.Location()).Format("2006-01-02")
	}
	shift := (int(at.Weekday()) + 6) % 7 // Monday = 0
	return at.AddDate(0, 0, -shift).Format("2006-01-02")
}

func clamp01(v float64) float64 {
	return math.Min(1, math.Max(0, v))
}

func b2f(v bool) float64 {
	if v {
		return 1
	}
	return 0
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
