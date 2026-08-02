package api

import (
	"context"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) analyticsRoutes(g *echo.Group) {
	g.GET("/analytics/summary", s.handleSummary)
	g.GET("/analytics/r-summary", s.handleRSummary)
	g.GET("/analytics/equity-curve", s.handleEquityCurve)
	g.GET("/analytics/daily", s.handleDaily)
	g.GET("/analytics/breakdown", s.handleBreakdown)
	g.GET("/analytics/compliance", s.handleCompliance)
	g.GET("/analytics/behavior", s.handleBehavior)
}

// grossPnlOf reads the stored gross P&L, reconstructing it from net + fees
// for rows imported before gross was recorded.
func grossPnlOf(t store.Trade) float64 {
	if t.GrossPnl.Valid {
		return t.GrossPnl.Float64
	}
	return t.NetPnl.Float64 + t.FeesTotal
}

func toClosedTrades(rows []store.Trade) []analytics.ClosedTrade {
	out := make([]analytics.ClosedTrade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		out = append(out, analytics.ClosedTrade{
			NetPnl:    t.NetPnl.Float64,
			GrossPnl:  grossPnlOf(t),
			FeesTotal: t.FeesTotal,
			OpenedAt:  t.OpenedAt,
			ClosedAt:  t.ClosedAt.Time,
		})
	}
	return out
}

func (s *Server) handleSummary(c echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(c.Request().Context(), auth.UserID(c), f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not compute summary", nil)
	}
	return c.JSON(http.StatusOK, analytics.Summarize(toClosedTrades(rows)))
}

func (s *Server) handleRSummary(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not compute r-summary", nil)
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
	var withRisk []analytics.RiskTrade
	excluded := 0
	for _, t := range rows {
		if !t.NetPnl.Valid {
			continue
		}
		risk, ok := riskByTrade[t.ID]
		if !ok || risk <= 0 {
			excluded++
			continue
		}
		withRisk = append(withRisk, analytics.RiskTrade{
			NetPnl: t.NetPnl.Float64, InitialRisk: risk, FeesTotal: t.FeesTotal,
		})
	}
	return c.JSON(http.StatusOK, analytics.SummarizeR(withRisk, excluded))
}

func (s *Server) handleDaily(c echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(c.Request().Context(), auth.UserID(c), f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not compute daily pnl", nil)
	}
	return c.JSON(http.StatusOK, analytics.DailyPnl(toClosedTrades(rows), f.DateBasis, f.Loc))
}

func (s *Server) handleEquityCurve(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not compute equity curve", nil)
	}
	startBal, err := s.startingBalance(ctx, uid, f.AccountID)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load balances", nil)
	}
	cashRows, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: uid, AccountID: accountArg(f.AccountID),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cash flows", nil)
	}
	flows := make([]analytics.CashFlow, 0, len(cashRows))
	for _, ct := range cashRows {
		flows = append(flows, analytics.CashFlow{Amount: ct.Amount, OccurredAt: ct.OccurredAt})
	}
	return c.JSON(http.StatusOK, analytics.EquityCurve(startBal, flows, toClosedTrades(rows)))
}

// startingBalance returns the sum of starting balances for the user (or one account).
func (s *Server) startingBalance(ctx context.Context, userID, accountID string) (float64, error) {
	accs, err := s.deps.Store.ListAccounts(ctx, userID)
	if err != nil {
		return 0, err
	}
	var sum float64
	for _, a := range accs {
		if accountID == "" || a.ID == accountID {
			sum += a.StartingBalance
		}
	}
	return sum, nil
}
