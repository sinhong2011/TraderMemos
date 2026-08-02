package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/excursion"
	"github.com/tradermemos/api/internal/store"
)

type excursionResp struct {
	Mae      float64 `json:"mae"`
	Mfe      float64 `json:"mfe"`
	Interval string  `json:"interval"`
	BarsUsed int     `json:"bars_used"`
	Provider string  `json:"provider"`
	// Post-exit values are null until the window after the close has traded.
	PostExitMae *float64 `json:"post_exit_mae"`
	PostExitMfe *float64 `json:"post_exit_mfe"`
}

// handleTradeExcursion computes MAE/MFE for a closed trade from market bars
// and saves the result into the trade journal.
func (s *Server) handleTradeExcursion(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	id := c.Param("id")

	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: id, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}
	if s.deps.Market == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "market data not configured", nil)
	}

	res, err := excursion.AutoCompute(ctx, s.deps.Store, s.deps.Market, t)
	switch {
	case errors.Is(err, excursion.ErrNotClosed),
		errors.Is(err, excursion.ErrOptionTrade),
		errors.Is(err, excursion.ErrNotChartable),
		errors.Is(err, excursion.ErrBarsExpired):
		return Fail(http.StatusUnprocessableEntity, "unprocessable", err.Error(), nil)
	case errors.Is(err, excursion.ErrBarsFetch):
		s.logger.Warn("excursion bars fetch failed", "trade", id, "symbol", t.Symbol, "err", err)
		return Fail(http.StatusBadGateway, "upstream_error", "could not fetch market data", nil)
	case errors.Is(err, excursion.ErrNoBars):
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "no market data covers this trade window", nil)
	case err != nil:
		return Fail(http.StatusInternalServerError, "internal", "could not compute excursion", nil)
	}

	return c.JSON(http.StatusOK, excursionResp{
		Mae: res.Mae, Mfe: res.Mfe,
		Interval: res.Interval, BarsUsed: res.BarsUsed, Provider: res.Provider,
		PostExitMae: res.PostExitMae, PostExitMfe: res.PostExitMfe,
	})
}
