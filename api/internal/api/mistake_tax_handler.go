package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
)

var ruleLabels = map[string]string{
	analytics.RuleOverMaxRisk:    "Over max risk per trade",
	analytics.RulePastDailyLoss:  "Past daily loss limit",
	analytics.RuleOverTradeLimit: "Over max trades per day",
	analytics.RulePastLossStreak: "Past losing-streak limit",
}

// handleMistakeTax prices the filtered closed trades that came from a mistake:
// a mistake tag the trader applied, a risk rule the trade broke, or a detected
// revenge / overconfidence entry. Cost counts losses only.
func (s *Server) handleMistakeTax(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not load trades")
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load journals", nil)
	}
	tagRows, err := s.deps.Store.ListTradeTagsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load tags", nil)
	}
	rules, err := s.complianceRules(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}

	risk := map[string]float64{}
	journalNote := map[string]bool{}
	for _, j := range journals {
		if j.InitialRisk.Valid {
			risk[j.TradeID] = j.InitialRisk.Float64
		}
		if strings.TrimSpace(j.Notes) != "" {
			journalNote[j.TradeID] = true
		}
	}

	flags := map[string][]analytics.MistakeSource{}
	for _, t := range tagRows {
		if t.Kind == "mistake" {
			flags[t.TradeID] = append(flags[t.TradeID], analytics.MistakeSource{
				Key: "tag:" + t.ID, Kind: analytics.MistakeKindTag, Label: t.Name,
			})
		}
	}

	taxTrades := make([]analytics.TaxTrade, 0, len(rows))
	compTrades := make([]analytics.ComplianceTrade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		taxTrades = append(taxTrades, analytics.TaxTrade{
			ID:          t.ID,
			NetPnl:      t.NetPnl.Float64,
			InitialRisk: risk[t.ID],
			ClosedAt:    t.ClosedAt.Time,
			Reviewed:    strings.TrimSpace(t.Notes) != "" || journalNote[t.ID],
		})
		compTrades = append(compTrades, analytics.ComplianceTrade{
			ID: t.ID, NetPnl: t.NetPnl.Float64, ClosedAt: t.ClosedAt.Time, InitialRisk: risk[t.ID],
		})
	}

	for id, broken := range analytics.Compliance(compTrades, rules, f.Loc).Violations {
		for _, rule := range broken {
			flags[id] = append(flags[id], analytics.MistakeSource{
				Key: "rule:" + rule, Kind: analytics.MistakeKindRule, Label: ruleLabels[rule],
			})
		}
	}

	behavior := analytics.Behavior(behaviorTrades(rows, nil), analytics.DefaultBehaviorConfig(), f.Loc)
	for _, ev := range behavior.Revenge.Events {
		flags[ev.TradeID] = append(flags[ev.TradeID], analytics.MistakeSource{
			Key: "behavior:revenge", Kind: analytics.MistakeKindBehavior, Label: "Revenge trade",
		})
	}
	for _, ev := range behavior.Overconfidence.Events {
		flags[ev.TradeID] = append(flags[ev.TradeID], analytics.MistakeSource{
			Key: "behavior:overconfidence", Kind: analytics.MistakeKindBehavior, Label: "Oversized after a win streak",
		})
	}

	return c.JSON(http.StatusOK, analytics.MistakeTax(taxTrades, flags, taxBucket(f), f.Loc))
}

// taxBucket trends a range of up to ~3 months by week, anything longer (or
// open-ended) by month.
func taxBucket(f Filters) string {
	if f.From != nil && f.To != nil && f.To.Sub(*f.From) <= 93*24*time.Hour {
		return "week"
	}
	return "month"
}
