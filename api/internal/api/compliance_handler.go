package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
)

// handleCompliance scores closed trades against the user's risk rules.
func (s *Server) handleCompliance(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
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
