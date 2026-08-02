package api

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/excursion"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/store"
)

type excursionResp struct {
	Mae      float64 `json:"mae"`
	Mfe      float64 `json:"mfe"`
	Interval string  `json:"interval"`
	BarsUsed int     `json:"bars_used"`
	Provider string  `json:"provider"`
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
	if t.Status != "closed" || !t.ClosedAt.Valid {
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "excursion needs a closed trade", nil)
	}
	if t.InstrumentType == "option" {
		// Bars for OCC symbols chart the underlying; pretending underlying
		// excursion is option P&L would mislead. Manual entry stays available.
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "auto excursion is not supported for options — enter MAE/MFE manually", nil)
	}
	if s.deps.Market == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "market data not configured", nil)
	}
	if !marketdata.ChartableSymbol(t.Symbol) || !marketdata.SupportedInstrument(t.InstrumentType) {
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "no market data source for this symbol", nil)
	}

	opened, closed := t.OpenedAt.UTC(), t.ClosedAt.Time.UTC()
	interval := excursion.ChooseInterval(opened, closed, time.Now().UTC())
	if interval == "D" && closed.Sub(opened) < 24*time.Hour {
		// Daily candles around an intraday trade would wildly overstate
		// excursion; better to report nothing than a wrong number.
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "intraday bars are no longer available for this trade", nil)
	}

	// One bar of padding on each side so the entry and exit bars are covered.
	pad := excursion.IntervalDuration(interval)
	req := marketdata.Request{
		Symbol:         t.Symbol,
		InstrumentType: t.InstrumentType,
		Interval:       interval,
		From:           marketdata.SnapChartTime(opened.Add(-pad)),
		To:             marketdata.SnapChartTime(closed.Add(pad)),
	}
	bars, err := s.deps.Market.GetBars(ctx, req)
	if err != nil {
		s.logger.Warn("excursion bars fetch failed", "trade", id, "symbol", t.Symbol, "err", err)
		return Fail(http.StatusBadGateway, "upstream_error", "could not fetch market data", nil)
	}

	execs, err := s.deps.Store.ListExecutionsForTrade(ctx, t.ID)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load fills", nil)
	}
	fills := make([]excursion.Fill, 0, len(execs))
	for _, e := range execs {
		fills = append(fills, excursion.Fill{
			Side: e.Side, Quantity: e.Quantity, Price: e.Price,
			Multiplier: e.Multiplier, ExecutedAt: e.ExecutedAt,
		})
	}

	res, err := excursion.Compute(bars.Bars, interval, fills)
	if errors.Is(err, excursion.ErrNoBars) {
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "no market data covers this trade window", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not compute excursion", nil)
	}

	// Merge into the journal without clobbering other fields.
	cur, jerr := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: t.ID, UserID: uid})
	if jerr != nil && !errors.Is(jerr, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load journal", nil)
	}
	if err := s.deps.Store.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
		TradeID: t.ID, UserID: uid,
		Notes: cur.Notes, SetupID: cur.SetupID, InitialRisk: cur.InitialRisk,
		TargetPrice: cur.TargetPrice, StopPrice: cur.StopPrice,
		EmotionalState: cur.EmotionalState, Confidence: cur.Confidence, TradeQuality: cur.TradeQuality,
		Mae: sql.NullFloat64{Float64: res.Mae, Valid: true},
		Mfe: sql.NullFloat64{Float64: res.Mfe, Valid: true},
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save excursion", nil)
	}

	return c.JSON(http.StatusOK, excursionResp{
		Mae: res.Mae, Mfe: res.Mfe,
		Interval: interval, BarsUsed: res.BarsUsed, Provider: bars.Provider,
	})
}
