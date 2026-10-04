package alerts

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/money"
)

// RuleWeeklyReview is the alert_events rule (and push data `type`) for the
// Saturday weekly-review nudge.
const RuleWeeklyReview = "weekly_review"

// NoteTypeWeeklyReview is the journal_notes.note_type the review lands in.
const NoteTypeWeeklyReview = "weekly_review"

// DefaultMarketTimezone is the market timezone the clients default to
// (MARKET_TIMEZONE_DEFAULT on web and mobile) — used when the account has
// never synced one.
const DefaultMarketTimezone = "America/New_York"

// The review is due from Saturday 09:00 in the market timezone. The trading
// week (Mon–Fri) is over by then, and it is late enough not to be a wake-up
// call.
const (
	reviewDayOffset = 5 // days after Monday: Saturday
	reviewHour      = 9
)

// ReviewWeek returns the Monday 00:00 (in loc) that starts the week holding
// now, and whether that week's review is due — now at or past Saturday 09:00
// of the same week. A review is never sent late for an earlier week: a server
// that is down all weekend skips that week rather than nudging on a Tuesday.
func ReviewWeek(now time.Time, loc *time.Location) (start time.Time, due bool) {
	if loc == nil {
		loc = time.UTC
	}
	local := now.In(loc)
	sinceMonday := (int(local.Weekday()) + 6) % 7
	start = time.Date(local.Year(), local.Month(), local.Day()-sinceMonday, 0, 0, 0, 0, loc)
	fireAt := time.Date(start.Year(), start.Month(), start.Day()+reviewDayOffset, reviewHour, 0, 0, 0, loc)
	return start, !local.Before(fireAt)
}

// WeekKey is the ledger key for the week starting at start (its Monday).
func WeekKey(start time.Time) string { return start.Format("2006-01-02") }

// weekEnd is the exclusive end of the week starting at start: the next
// Monday 00:00. AddDate keeps it on local midnight across a DST change.
func weekEnd(start time.Time) time.Time { return start.AddDate(0, 0, 7) }

// WeekLabel renders a week as "Sep 28 – Oct 4" (Monday to Sunday).
func WeekLabel(start time.Time) string {
	last := start.AddDate(0, 0, 6)
	return start.Format("Jan 2") + " – " + last.Format("Jan 2")
}

// WeeklyTrade is the closed-trade view the weekly review needs.
type WeeklyTrade struct {
	NetPnl      float64
	ClosedAt    time.Time
	InitialRisk float64 // 0 = not recorded
	Setup       string  // "" = no setup tagged
	Currency    string
}

// CurrencyAmount is a P&L total in one currency.
type CurrencyAmount struct {
	Currency string
	Amount   float64
}

// SetupResult is one setup's net P&L over the week.
type SetupResult struct {
	Name   string
	NetPnl float64
	Trades int
}

// WeeklyStats is the week the review covers.
type WeeklyStats struct {
	Start time.Time // Monday 00:00 in the market timezone
	// Trades closed in the week, and the win/loss split (breakevens count
	// toward Trades only).
	Trades, Wins, Losses int
	WinRate              float64 // 0–1
	// NetPnl per currency, the most-traded first. Never empty: a week with
	// no trades holds one zero amount in the default currency.
	NetPnl []CurrencyAmount
	// R over the trades with a recorded initial risk.
	RTrades      int
	TotalR, AvgR float64
	Setups       int // distinct setups traded (in the main currency)
	Best, Worst  *SetupResult
	RulesSet     bool
	RuleBreaks   int
	MissedTrades int
}

// ComputeWeekly summarizes the week starting at start. trades and missed may
// span any period — only what falls inside the week (in loc) counts. Setup
// rankings use the most-traded currency only: summing dollars and yen into
// one "best setup" would rank nothing. defaultCurrency labels the zero P&L of
// an empty week.
func ComputeWeekly(trades []WeeklyTrade, rules analytics.ComplianceRules, missed []time.Time, start time.Time, loc *time.Location, defaultCurrency string) WeeklyStats {
	if loc == nil {
		loc = time.UTC
	}
	start = start.In(loc)
	end := weekEnd(start)
	inWeek := func(at time.Time) bool { return !at.Before(start) && at.Before(end) }

	st := WeeklyStats{Start: start, RulesSet: rules.MaxRiskPerTrade > 0 || rules.MaxDailyLoss > 0 ||
		rules.MaxTradesPerDay > 0 || rules.MaxConsecutiveLosses > 0}

	var week []WeeklyTrade
	for _, t := range trades {
		if inWeek(t.ClosedAt) {
			week = append(week, t)
		}
	}
	for _, at := range missed {
		if inWeek(at) {
			st.MissedTrades++
		}
	}

	pnl := map[string]float64{}
	count := map[string]int{}
	var compliance []analytics.ComplianceTrade
	for _, t := range week {
		st.Trades++
		switch {
		case t.NetPnl > 0:
			st.Wins++
		case t.NetPnl < 0:
			st.Losses++
		}
		cur := t.Currency
		if cur == "" {
			cur = defaultCurrency
		}
		pnl[cur] += t.NetPnl
		count[cur]++
		if t.InitialRisk > 0 {
			st.RTrades++
			st.TotalR += t.NetPnl / t.InitialRisk
		}
		compliance = append(compliance, analytics.ComplianceTrade{
			NetPnl: t.NetPnl, ClosedAt: t.ClosedAt, InitialRisk: t.InitialRisk,
		})
	}
	if st.Trades > 0 {
		st.WinRate = float64(st.Wins) / float64(st.Trades)
	}
	if st.RTrades > 0 {
		st.AvgR = st.TotalR / float64(st.RTrades)
	}

	currencies := make([]string, 0, len(pnl))
	for c := range pnl {
		currencies = append(currencies, c)
	}
	sort.Slice(currencies, func(i, j int) bool {
		if count[currencies[i]] != count[currencies[j]] {
			return count[currencies[i]] > count[currencies[j]]
		}
		return currencies[i] < currencies[j]
	})
	for _, c := range currencies {
		st.NetPnl = append(st.NetPnl, CurrencyAmount{Currency: c, Amount: round2(pnl[c])})
	}
	if len(st.NetPnl) == 0 {
		st.NetPnl = []CurrencyAmount{{Currency: defaultCurrency}}
	}

	main := st.NetPnl[0].Currency
	bySetup := map[string]*SetupResult{}
	for _, t := range week {
		cur := t.Currency
		if cur == "" {
			cur = defaultCurrency
		}
		if t.Setup == "" || cur != main {
			continue
		}
		r, ok := bySetup[t.Setup]
		if !ok {
			r = &SetupResult{Name: t.Setup}
			bySetup[t.Setup] = r
		}
		r.NetPnl += t.NetPnl
		r.Trades++
	}
	ranked := make([]SetupResult, 0, len(bySetup))
	for _, r := range bySetup {
		r.NetPnl = round2(r.NetPnl)
		ranked = append(ranked, *r)
	}
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].NetPnl != ranked[j].NetPnl {
			return ranked[i].NetPnl > ranked[j].NetPnl
		}
		return ranked[i].Name < ranked[j].Name
	})
	st.Setups = len(ranked)
	if len(ranked) > 0 {
		best, worst := ranked[0], ranked[len(ranked)-1]
		st.Best, st.Worst = &best, &worst
	}

	if st.RulesSet {
		rep := analytics.Compliance(compliance, rules, loc)
		st.RuleBreaks = rep.RiskViolations + rep.DailyLossBreaches + rep.TradeLimitBreaches + rep.LossStreakBreaches
	}
	return st
}

// WeeklyNoteTitle is the review note's title: "Week of Sep 28 – Oct 4".
func WeeklyNoteTitle(start time.Time) string { return "Week of " + WeekLabel(start) }

// WeeklyNoteBody is the review note's markdown: the stats block, then the
// three prompts left empty for the owner to fill in.
func WeeklyNoteBody(st WeeklyStats) string {
	var b strings.Builder
	line := func(label, value string) { fmt.Fprintf(&b, "- %s: %s\n", label, value) }

	b.WriteString("## Week in numbers\n\n")
	line("Net P&L", formatPnlList(st.NetPnl))
	line("Trades", fmt.Sprintf("%d (%d won, %d lost)", st.Trades, st.Wins, st.Losses))
	line("Win rate", formatPct(st.WinRate))
	if st.RTrades > 0 {
		noun := "trades"
		if st.RTrades == 1 {
			noun = "trade"
		}
		line("R", fmt.Sprintf("%s total, %s average (%d %s with risk set)",
			formatR(st.TotalR), formatR(st.AvgR), st.RTrades, noun))
	} else {
		line("R", "no trades with risk set")
	}
	main := st.NetPnl[0].Currency
	switch {
	case st.Setups == 0:
		line("Setups", "none tagged")
	case st.Setups == 1:
		line("Best setup", formatSetup(*st.Best, main))
		line("Worst setup", "only one setup traded")
	default:
		line("Best setup", formatSetup(*st.Best, main))
		line("Worst setup", formatSetup(*st.Worst, main))
	}
	if st.RulesSet {
		line("Rule breaks", strconv.Itoa(st.RuleBreaks))
	} else {
		line("Rule breaks", "no risk rules set")
	}
	line("Missed trades", strconv.Itoa(st.MissedTrades))

	b.WriteString("\n## What worked\n\n\n")
	b.WriteString("## What didn't\n\n\n")
	b.WriteString("## Focus for next week\n\n")
	return b.String()
}

// WeeklyEvent is the push/webhook for a finished review: a one-line summary
// plus data that opens the note. `route` is an app path any alert can carry —
// the mobile app navigates to it on tap.
func WeeklyEvent(st WeeklyStats, noteID string) Event {
	var body string
	if st.Trades == 0 {
		body = "No trades this week. Tap to write your review."
	} else {
		parts := []string{
			formatPnlList(st.NetPnl) + " on " + formatTradeCount(st.Trades),
			formatPct(st.WinRate) + " win rate",
		}
		if st.RTrades > 0 {
			parts = append(parts, formatR(st.TotalR))
		}
		body = strings.Join(parts, ", ") + ". Tap to write your review."
	}
	week := WeekKey(st.Start)
	return Event{
		Rule:      RuleWeeklyReview,
		DedupeKey: week,
		Title:     "Weekly review: " + WeekLabel(st.Start),
		Body:      body,
		Data: map[string]string{
			"type":       RuleWeeklyReview,
			"note_id":    noteID,
			"week_start": week,
			"route":      "/edit-note?id=" + noteID,
		},
	}
}

func formatTradeCount(n int) string {
	if n == 1 {
		return "1 trade"
	}
	return strconv.Itoa(n) + " trades"
}

func formatSetup(r SetupResult, currency string) string {
	noun := "trades"
	if r.Trades == 1 {
		noun = "trade"
	}
	return fmt.Sprintf("%s, %s over %d %s", r.Name, formatMoney(r.NetPnl, currency), r.Trades, noun)
}

func formatPnlList(xs []CurrencyAmount) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = formatMoney(x.Amount, x.Currency)
	}
	return strings.Join(parts, " / ")
}

func formatPct(f float64) string { return strconv.FormatFloat(f*100, 'f', 1, 64) + "%" }

func formatR(r float64) string {
	r = round2(r)
	sign := ""
	if r > 0 {
		sign = "+"
	}
	return sign + strconv.FormatFloat(r, 'f', 2, 64) + "R"
}

var currencySymbols = map[string]string{
	"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "HKD": "HK$",
	"CAD": "CA$", "AUD": "A$",
}

// formatMoney renders a signed amount: "+$1,234.50", "-$320.00", "$0.00",
// or "+1,234.50 SGD" for currencies without a symbol here.
func formatMoney(amount float64, currency string) string {
	amount = round2(amount)
	sign := ""
	switch {
	case amount > 0:
		sign = "+"
	case amount < 0:
		sign = "-"
	}
	digits := groupThousands(strconv.FormatFloat(math.Abs(amount), 'f', 2, 64))
	if sym, ok := currencySymbols[strings.ToUpper(currency)]; ok {
		return sign + sym + digits
	}
	if currency == "" {
		return sign + digits
	}
	return sign + digits + " " + strings.ToUpper(currency)
}

func groupThousands(s string) string {
	intPart, frac, _ := strings.Cut(s, ".")
	var b strings.Builder
	for i, c := range intPart {
		if i > 0 && (len(intPart)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	if frac != "" {
		b.WriteByte('.')
		b.WriteString(frac)
	}
	return b.String()
}

func round2(v float64) float64 { return money.Round2(v) }
