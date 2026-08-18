package coach

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// SessionWindow bounds how far back the session context looks. Drawdown and
// streak are computed over this window rather than all history so a coach
// call stays O(window) for a trader with years of trades; the rendered brief
// labels the bound so the model does not read it as an all-time peak.
const SessionWindow = 180 * 24 * time.Hour

// maxRecentTrades is how many prior closes are listed individually.
const maxRecentTrades = 3

// PriorTrade is one already-closed trade used to reconstruct the trader's
// state at the moment the reviewed trade was entered.
type PriorTrade struct {
	Symbol    string
	NetPnl    float64
	RMultiple *float64
	Currency  string
	ClosedAt  time.Time
	Emotion   string
}

// RecentTrade is one line of the "last few closes" tail.
type RecentTrade struct {
	Symbol    string
	NetPnl    float64
	RMultiple *float64
	ClosedAt  time.Time
	Emotion   string
}

// SessionContext is the trader's state as of the reviewed trade's entry — not
// as of now. A trade opened three weeks ago is judged against the day it was
// actually taken, so only trades that closed strictly before its entry count.
type SessionContext struct {
	Day              string  // YYYY-MM-DD of the entry, market timezone
	Currency         string  // currency the sums are denominated in
	PriorTradesToday int     // closes on the entry's market day, before entry
	RealizedToday    float64 // net P&L of those closes
	RealizedRToday   *float64
	PriorTradesWeek  int
	RealizedWeek     float64
	StreakKind       string // "win" | "loss" | "" when undetermined
	StreakLen        int
	Drawdown         float64 // positive magnitude off the windowed peak
	TradesSincePeak  int
	Recent           []RecentTrade
	SkippedOtherCcy  int  // priors dropped for not matching Currency
	PriorsSeen       int  // priors that informed streak and drawdown
	Bounded          bool // whether the window clipped the history
}

// BuildSessionContext reconstructs the trader's state at entry from trades
// that closed before it. Priors in another currency are dropped rather than
// summed — this project does not convert across currencies — and counted so
// the brief can disclose the omission instead of silently understating a day.
func BuildSessionContext(
	entry time.Time,
	currency string,
	priors []PriorTrade,
	loc *time.Location,
) SessionContext {
	if loc == nil {
		loc = time.UTC
	}
	local := entry.In(loc)
	sc := SessionContext{
		Day:      local.Format("2006-01-02"),
		Currency: currency,
		Recent:   []RecentTrade{},
	}

	cutoff := entry.Add(-SessionWindow)
	kept := make([]PriorTrade, 0, len(priors))
	for _, p := range priors {
		if !p.ClosedAt.Before(entry) {
			continue
		}
		if currency != "" && p.Currency != "" && p.Currency != currency {
			sc.SkippedOtherCcy++
			continue
		}
		if p.ClosedAt.Before(cutoff) {
			sc.Bounded = true
			continue
		}
		kept = append(kept, p)
	}
	if len(kept) == 0 {
		return sc
	}
	sort.SliceStable(kept, func(i, j int) bool { return kept[i].ClosedAt.Before(kept[j].ClosedAt) })
	sc.PriorsSeen = len(kept)

	entryYear, entryWeek := local.ISOWeek()
	var rSum float64
	var rSeen int
	for _, p := range kept {
		closeLocal := p.ClosedAt.In(loc)
		if closeLocal.Format("2006-01-02") == sc.Day {
			sc.PriorTradesToday++
			sc.RealizedToday += p.NetPnl
			if p.RMultiple != nil {
				rSum += *p.RMultiple
				rSeen++
			}
		}
		if y, w := closeLocal.ISOWeek(); y == entryYear && w == entryWeek {
			sc.PriorTradesWeek++
			sc.RealizedWeek += p.NetPnl
		}
	}
	if rSeen > 0 {
		sc.RealizedRToday = &rSum
	}

	sc.StreakKind, sc.StreakLen = streak(kept)
	sc.Drawdown, sc.TradesSincePeak = drawdown(kept)

	for i := len(kept) - 1; i >= 0 && len(sc.Recent) < maxRecentTrades; i-- {
		p := kept[i]
		sc.Recent = append(sc.Recent, RecentTrade{
			Symbol:    p.Symbol,
			NetPnl:    p.NetPnl,
			RMultiple: p.RMultiple,
			ClosedAt:  p.ClosedAt,
			Emotion:   p.Emotion,
		})
	}
	return sc
}

// streak walks back from the most recent close. A scratch (exactly flat)
// trade ends the run rather than extending either side of it.
func streak(sorted []PriorTrade) (string, int) {
	if len(sorted) == 0 {
		return "", 0
	}
	last := sorted[len(sorted)-1].NetPnl
	if last == 0 {
		return "", 0
	}
	kind := "win"
	if last < 0 {
		kind = "loss"
	}
	n := 0
	for i := len(sorted) - 1; i >= 0; i-- {
		p := sorted[i].NetPnl
		if p == 0 || (p > 0) != (last > 0) {
			break
		}
		n++
	}
	return kind, n
}

// drawdown returns how far cumulative realized P&L sits below its running
// peak within the window, and how many trades have closed since that peak.
//
// The peak starts at the window's zero point, not at the first trade: a
// trader whose only trade is a loser is in drawdown by that loss, not flat.
func drawdown(sorted []PriorTrade) (float64, int) {
	var cum, peak float64
	peakIdx := -1 // -1 = the pre-trade zero is still the high-water mark
	for i, p := range sorted {
		cum += p.NetPnl
		if cum > peak {
			peak = cum
			peakIdx = i
		}
	}
	if peak <= cum {
		return 0, 0
	}
	return peak - cum, len(sorted) - 1 - peakIdx
}

// format renders the session block appended to the trade brief.
func (s SessionContext) format() string {
	var b strings.Builder
	b.WriteString("\nTrader state at the moment this trade was entered")
	b.WriteString(" (not today — reconstructed from trades that closed before this entry):\n")
	fmt.Fprintf(&b, "Entry day: %s\n", s.Day)
	fmt.Fprintf(&b, "Prior closed trades that day: %d\n", s.PriorTradesToday)
	fmt.Fprintf(&b, "Realized that day before entry: %g %s\n", s.RealizedToday, s.Currency)
	if s.RealizedRToday != nil {
		fmt.Fprintf(&b, "Realized that day in R: %g\n", *s.RealizedRToday)
	}
	fmt.Fprintf(&b, "Prior closed trades that week: %d (realized %g %s)\n",
		s.PriorTradesWeek, s.RealizedWeek, s.Currency)

	switch {
	case s.StreakLen > 0 && s.StreakKind == "loss":
		fmt.Fprintf(&b, "Current streak: %d consecutive losses\n", s.StreakLen)
	case s.StreakLen > 0:
		fmt.Fprintf(&b, "Current streak: %d consecutive wins\n", s.StreakLen)
	default:
		b.WriteString("Current streak: none\n")
	}

	window := "180d"
	if !s.Bounded {
		window = "all recorded"
	}
	if s.Drawdown > 0 {
		fmt.Fprintf(&b, "Drawdown: %g %s below the %s peak, %d trades since that peak\n",
			s.Drawdown, s.Currency, window, s.TradesSincePeak)
	} else {
		fmt.Fprintf(&b, "Drawdown: at the %s equity peak\n", window)
	}
	fmt.Fprintf(&b, "Streak and drawdown computed over %d prior closed trades.\n", s.PriorsSeen)

	if len(s.Recent) > 0 {
		b.WriteString("Most recent closes before this entry (newest first):\n")
		for i, r := range s.Recent {
			fmt.Fprintf(&b, "  %d. %s net=%g", i+1, r.Symbol, r.NetPnl)
			if r.RMultiple != nil {
				fmt.Fprintf(&b, " R=%g", *r.RMultiple)
			}
			if e := strings.TrimSpace(r.Emotion); e != "" {
				fmt.Fprintf(&b, " emotion=%s", e)
			}
			fmt.Fprintf(&b, " closed %s\n", r.ClosedAt.UTC().Format(time.RFC3339))
		}
	}
	if s.SkippedOtherCcy > 0 {
		fmt.Fprintf(&b, "Note: %d prior trades in another currency were excluded from these sums.\n",
			s.SkippedOtherCcy)
	}
	return b.String()
}
