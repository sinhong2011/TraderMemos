package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/coach"
	"github.com/tradermemos/api/internal/store"
)

type coachReviewDTO struct {
	Source string       `json:"source"` // llm | off | error
	Notes  []coach.Note `json:"notes"`
	Error  string       `json:"error,omitempty"`
}

func (s *Server) handleTradeCoach(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	tradeID := c.Param("id")

	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: tradeID, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}

	detail, err := s.buildTradeDetail(ctx, uid, t)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade detail", nil)
	}

	cfg := s.effectiveCoachConfig(ctx)
	if !cfg.Ready() {
		return c.JSON(http.StatusOK, coachReviewDTO{Source: "off", Notes: []coach.Note{}})
	}

	review, err := coach.GenerateReview(ctx, cfg, tradeContextFromDetail(detail))
	if err != nil {
		if errors.Is(err, coach.ErrUnavailable) {
			return c.JSON(http.StatusOK, coachReviewDTO{Source: "off", Notes: []coach.Note{}})
		}
		msg := strings.TrimSpace(err.Error())
		if msg == "" {
			msg = "coach generation failed"
		}
		if errors.Is(err, coach.ErrTimeout) {
			s.logger.Warn("coach review timed out", "trade_id", tradeID, "err", err)
		} else {
			s.logger.Warn("coach review failed", "trade_id", tradeID, "err", err)
		}
		return c.JSON(http.StatusOK, coachReviewDTO{
			Source: "error",
			Notes:  []coach.Note{},
			Error:  msg,
		})
	}
	if review.Notes == nil {
		review.Notes = []coach.Note{}
	}
	return c.JSON(http.StatusOK, coachReviewDTO{Source: "llm", Notes: review.Notes})
}

func tradeContextFromDetail(d tradeDetailDTO) coach.TradeContext {
	tags := make([]string, 0, len(d.Tags))
	for _, t := range d.Tags {
		tags = append(tags, t.Name)
	}
	fills := make([]coach.FillContext, 0, len(d.Fills))
	for _, f := range d.Fills {
		fills = append(fills, coach.FillContext{
			Side:       f.Side,
			Quantity:   f.Quantity,
			Price:      f.Price,
			Fees:       f.Fees,
			ExecutedAt: f.ExecutedAt,
		})
	}
	setupName := ""
	if d.Setup != nil {
		setupName = d.Setup.Name
	}
	return coach.TradeContext{
		Symbol:         d.Symbol,
		InstrumentType: d.InstrumentType,
		Direction:      d.Direction,
		Status:         d.Status,
		OpenedAt:       d.OpenedAt,
		ClosedAt:       d.ClosedAt,
		QtyOpened:      d.QtyOpened,
		QtyRemaining:   d.QtyRemaining,
		AvgEntry:       d.AvgEntryPrice,
		AvgExit:        d.AvgExitPrice,
		GrossPnl:       d.GrossPnl,
		FeesTotal:      d.FeesTotal,
		NetPnl:         d.NetPnl,
		Currency:       d.PnlCurrency,
		ReturnPct:      d.ReturnPct,
		HoldSecs:       d.TimeInTradeSecs,
		InitialRisk:    d.InitialRisk,
		TargetPrice:    d.TargetPrice,
		StopPrice:      d.StopPrice,
		RMultiple:      d.RMultiple,
		Mae:            d.Mae,
		Mfe:            d.Mfe,
		Emotion:        d.EmotionalState,
		SetupName:      setupName,
		SetupGrade:     d.Confidence,
		ExecGrade:      d.TradeQuality,
		Notes:          d.Notes,
		TagNames:       tags,
		Fills:          fills,
	}
}
