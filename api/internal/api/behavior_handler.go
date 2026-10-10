package api

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

// handleBehavior runs the behavioral-pattern detectors over closed trades.
func (s *Server) handleBehavior(c *echo.Context) error {
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
	mfeByTrade := make(map[string]float64, len(journals))
	for _, j := range journals {
		if j.Mfe.Valid {
			mfeByTrade[j.TradeID] = j.Mfe.Float64
		}
	}

	trades := behaviorTrades(rows, mfeByTrade)
	return c.JSON(http.StatusOK, analytics.Behavior(trades, analytics.DefaultBehaviorConfig(), f.Loc))
}

// behaviorTrades maps closed trades into the behavior detectors' input.
func behaviorTrades(rows []store.Trade, mfeByTrade map[string]float64) []analytics.BehaviorTrade {
	trades := make([]analytics.BehaviorTrade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		bt := analytics.BehaviorTrade{
			ID:            t.ID,
			Symbol:        t.Symbol,
			QtyOpened:     t.QtyOpened,
			AvgEntryPrice: t.AvgEntryPrice,
			NetPnl:        t.NetPnl.Float64,
			OpenedAt:      t.OpenedAt,
			ClosedAt:      t.ClosedAt.Time,
		}
		if t.TimeInTradeSecs.Valid {
			bt.TimeInTradeSecs = t.TimeInTradeSecs.Int64
		}
		if mfe, ok := mfeByTrade[t.ID]; ok {
			v := mfe
			bt.Mfe = &v
		}
		trades = append(trades, bt)
	}
	return trades
}
