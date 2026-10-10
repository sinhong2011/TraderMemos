package api

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
)

// handleSetupScorecard scores each playbook setup on the filtered closed trades:
// expectancy (in R when enough trades carry a risk), a 95% interval, and a
// verdict — edge, execution problem, promising, watch, unproven or bleeding.
// Trades are grouped by their main setup; trades without one come back as None.
func (s *Server) handleSetupScorecard(c *echo.Context) error {
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
	setups, err := s.deps.Store.ListSetups(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load setups", nil)
	}
	rules, err := s.complianceRules(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}

	type plan struct {
		setupID string
		risk    float64
	}
	plans := make(map[string]plan, len(journals))
	for _, j := range journals {
		p := plan{}
		if j.SetupID.Valid {
			p.setupID = j.SetupID.String
		}
		if j.InitialRisk.Valid {
			p.risk = j.InitialRisk.Float64
		}
		plans[j.TradeID] = p
	}
	risk := make(map[string]float64, len(plans))
	for id, p := range plans {
		if p.risk > 0 {
			risk[id] = p.risk
		}
	}
	// "Clean" drops every trade the mistake tax would charge: mistake tags,
	// broken risk rules, and revenge / oversized entries.
	flags := mistakeFlags(rows, risk, tagRows, rules, f.Loc)
	names := make(map[string]string, len(setups))
	for _, st := range setups {
		names[st.ID] = st.Name
	}

	groups := map[string][]analytics.ScorecardTrade{}
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		p := plans[t.ID]
		// A setup deleted since the trade was journaled scores as "no setup".
		if _, ok := names[p.setupID]; !ok {
			p.setupID = ""
		}
		groups[p.setupID] = append(groups[p.setupID], analytics.ScorecardTrade{
			NetPnl:      t.NetPnl.Float64,
			InitialRisk: p.risk,
			Mistake:     len(flags[t.ID]) > 0,
			OpenedAt:    t.OpenedAt,
		})
	}

	now := time.Now().UTC()
	out := analytics.SetupScorecard{Setups: []analytics.SetupScore{}}
	for id, ts := range groups {
		if id == "" {
			none := analytics.ScoreSetup("", "", ts, now)
			out.None = &none
			continue
		}
		out.Setups = append(out.Setups, analytics.ScoreSetup(id, names[id], ts, now))
	}
	analytics.SortScorecard(out.Setups)
	return c.JSON(http.StatusOK, out)
}
