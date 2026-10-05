package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
)

// handleCompliance scores closed trades against the user's risk rules.
func (s *Server) handleCompliance(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	rules, err := s.complianceRules(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}

	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not load trades")
	}
	risks, err := s.deps.Store.ListJournalRisks(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk", nil)
	}
	riskByTrade := make(map[string]float64, len(risks))
	for _, r := range risks {
		if r.InitialRisk.Valid {
			riskByTrade[r.TradeID] = r.InitialRisk.Float64
		}
	}

	trades := make([]analytics.ComplianceTrade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		trades = append(trades, analytics.ComplianceTrade{
			NetPnl:      t.NetPnl.Float64,
			ClosedAt:    t.ClosedAt.Time,
			InitialRisk: riskByTrade[t.ID],
		})
	}
	return c.JSON(http.StatusOK, analytics.Compliance(trades, rules, f.Loc))
}

// complianceRules loads the user's enforceable risk rules; none set → zero rules.
func (s *Server) complianceRules(ctx context.Context, uid string) (analytics.ComplianceRules, error) {
	rules := analytics.ComplianceRules{}
	row, err := s.deps.Store.GetRiskRules(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return rules, nil
	}
	if err != nil {
		return rules, err
	}
	if row.MaxRiskPerTrade.Valid {
		rules.MaxRiskPerTrade = row.MaxRiskPerTrade.Float64
	}
	if row.MaxDailyLoss.Valid {
		rules.MaxDailyLoss = row.MaxDailyLoss.Float64
	}
	if row.MaxTradesPerDay.Valid {
		rules.MaxTradesPerDay = int(row.MaxTradesPerDay.Int64)
	}
	if row.MaxConsecutiveLosses.Valid {
		rules.MaxConsecutiveLosses = int(row.MaxConsecutiveLosses.Int64)
	}
	return rules, nil
}
