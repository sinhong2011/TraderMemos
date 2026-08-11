package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
)

// handleExecScore computes the execution-quality composite (Entry / Exit /
// Risk / Stability / Tempo) with its per-axis drill-down series.
func (s *Server) handleExecScore(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	bucket := c.QueryParam("bucket")
	switch bucket {
	case "", "week", "month":
	default:
		return Fail(http.StatusBadRequest, "bad_request", "bucket must be week or month", nil)
	}
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	rulesRow, err := s.deps.Store.GetRiskRules(ctx, uid)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}
	rules := analytics.ComplianceRules{}
	if err == nil {
		if rulesRow.MaxRiskPerTrade.Valid {
			rules.MaxRiskPerTrade = rulesRow.MaxRiskPerTrade.Float64
		}
		if rulesRow.MaxDailyLoss.Valid {
			rules.MaxDailyLoss = rulesRow.MaxDailyLoss.Float64
		}
	}

	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trades", nil)
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load journals", nil)
	}
	type excursion struct {
		mae, mfe *float64
		risk     float64
	}
	byTrade := make(map[string]excursion, len(journals))
	for _, j := range journals {
		var e excursion
		if j.Mae.Valid {
			v := j.Mae.Float64
			e.mae = &v
		}
		if j.Mfe.Valid {
			v := j.Mfe.Float64
			e.mfe = &v
		}
		if j.InitialRisk.Valid {
			e.risk = j.InitialRisk.Float64
		}
		byTrade[j.TradeID] = e
	}

	trades := make([]analytics.ScoreTrade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		st := analytics.ScoreTrade{
			ID:       t.ID,
			Symbol:   t.Symbol,
			NetPnl:   t.NetPnl.Float64,
			OpenedAt: t.OpenedAt,
			ClosedAt: t.ClosedAt.Time,
		}
		if e, ok := byTrade[t.ID]; ok {
			st.Mae, st.Mfe, st.InitialRisk = e.mae, e.mfe, e.risk
		}
		trades = append(trades, st)
	}
	cfg := analytics.DefaultExecScoreConfig()
	return c.JSON(http.StatusOK, analytics.ExecScore(trades, rules, cfg, f.Loc, bucket))
}
