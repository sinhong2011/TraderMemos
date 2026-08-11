package api

import (
	"net/http"
	"sort"
	"strconv"

	"github.com/labstack/echo/v5"
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
	g.GET("/analytics/montecarlo", s.handleMonteCarlo)
	g.GET("/analytics/execution-score", s.handleExecScore)
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

func (s *Server) handleSummary(c *echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(c.Request().Context(), auth.UserID(c), f)
	if err != nil {
		return failLoad(err, "could not compute summary")
	}
	return c.JSON(http.StatusOK, analytics.Summarize(toClosedTrades(rows)))
}

func (s *Server) handleRSummary(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not compute r-summary")
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

// handleMonteCarlo bootstrap-resamples the filtered closed trades' net P&L.
// Optional params: paths, horizon, seed (reproducible runs), ruin_threshold
// (currency drawdown counted as ruin; defaults to the historical max
// drawdown).
func (s *Server) handleMonteCarlo(c *echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	params := analytics.MonteCarloParams{}
	if params.Seed, err = uintParam(c, "seed"); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid 'seed' (want unsigned integer)", nil)
	}
	intParams := map[string]*int{"paths": &params.Paths, "horizon": &params.Horizon}
	for name, dst := range intParams {
		if v := c.QueryParam(name); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 0 {
				return Fail(http.StatusBadRequest, "bad_request", "invalid '"+name+"' (want positive integer)", nil)
			}
			*dst = n
		}
	}
	if v := c.QueryParam("ruin_threshold"); v != "" {
		t, err := strconv.ParseFloat(v, 64)
		if err != nil || t < 0 {
			return Fail(http.StatusBadRequest, "bad_request", "invalid 'ruin_threshold' (want positive number)", nil)
		}
		params.RuinThreshold = t
	}

	rows, err := s.loadClosedTrades(c.Request().Context(), auth.UserID(c), f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not run simulation", nil)
	}
	trades := toClosedTrades(rows)
	// Chronological order matters only for the historical-drawdown anchor;
	// the bootstrap itself samples i.i.d.
	sort.Slice(trades, func(i, j int) bool { return trades[i].ClosedAt.Before(trades[j].ClosedAt) })
	pnls := make([]float64, len(trades))
	for i, t := range trades {
		pnls[i] = t.NetPnl
	}
	return c.JSON(http.StatusOK, analytics.MonteCarlo(pnls, params))
}

func uintParam(c *echo.Context, name string) (uint64, error) {
	v := c.QueryParam(name)
	if v == "" {
		return 0, nil
	}
	return strconv.ParseUint(v, 10, 64)
}

func (s *Server) handleDaily(c *echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(c.Request().Context(), auth.UserID(c), f)
	if err != nil {
		return failLoad(err, "could not compute daily pnl")
	}
	return c.JSON(http.StatusOK, analytics.DailyPnl(toClosedTrades(rows), f.DateBasis, f.Loc))
}

func (s *Server) handleEquityCurve(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}

	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not compute equity curve")
	}
	cashRows, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: uid, AccountID: f.accountNarg(),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cash flows", nil)
	}
	flows := make([]analytics.CashFlow, 0, len(cashRows))
	for _, ct := range cashRows {
		if !f.matchAccount(ct.AccountID) {
			continue
		}
		flows = append(flows, analytics.CashFlow{Amount: ct.Amount, OccurredAt: ct.OccurredAt})
	}
	// The curve starts at zero: accounts.starting_balance is metadata only, it is
	// already seeded into the ledger as the "Opening balance" deposit
	// (ensureOpeningDeposit), so adding it here would count that money twice.
	return c.JSON(http.StatusOK, analytics.EquityCurve(0, flows, toClosedTrades(rows)))
}
