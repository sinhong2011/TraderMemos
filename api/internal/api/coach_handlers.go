package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/coach"
	"github.com/tradermemos/api/internal/store"
)

type coachReviewDTO struct {
	Source string       `json:"source"` // llm | off | error
	Notes  []coach.Note `json:"notes"`
	Error  string       `json:"error,omitempty"`
}

func (s *Server) handleTradeCoach(c *echo.Context) error {
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

	tradeCtx := tradeContextFromDetail(detail)
	// A failed session lookup degrades the review rather than failing it: the
	// single-trade brief is still worth generating.
	if session, serr := s.coachSession(ctx, uid, detail, coachLoc(c)); serr != nil {
		c.Logger().Warn("coach session context unavailable", "trade_id", tradeID, "err", serr)
	} else {
		tradeCtx.Session = session
	}

	review, err := coach.GenerateReview(ctx, cfg, tradeCtx)
	if err != nil {
		if errors.Is(err, coach.ErrUnavailable) {
			return c.JSON(http.StatusOK, coachReviewDTO{Source: "off", Notes: []coach.Note{}})
		}
		msg := strings.TrimSpace(err.Error())
		if msg == "" {
			msg = "coach generation failed"
		}
		if errors.Is(err, coach.ErrTimeout) {
			c.Logger().Warn("coach review timed out", "trade_id", tradeID, "err", err)
		} else {
			c.Logger().Warn("coach review failed", "trade_id", tradeID, "err", err)
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

// coachLoc resolves the market timezone the day and week boundaries are drawn
// in. Grouping always follows the market clock, never the display clock, so
// the client passes the same `tz` the analytics endpoints take.
func coachLoc(c *echo.Context) *time.Location {
	if v := c.QueryParam("tz"); v != "" {
		if loc, err := time.LoadLocation(v); err == nil {
			return loc
		}
	}
	return time.UTC
}

// coachSession reconstructs the trader's state as of the reviewed trade's
// entry from the other closed trades in the same account.
func (s *Server) coachSession(
	ctx context.Context,
	userID string,
	d tradeDetailDTO,
	loc *time.Location,
) (*coach.SessionContext, error) {
	rows, err := s.deps.Store.ListClosedTrades(ctx, store.ListClosedTradesParams{
		UserID:    userID,
		AccountID: d.AccountID,
	})
	if err != nil {
		return nil, err
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	emotionByTrade := make(map[string]string, len(journals))
	for _, j := range journals {
		if e := strings.TrimSpace(j.EmotionalState); e != "" {
			emotionByTrade[j.TradeID] = e
		}
	}

	priors := make([]coach.PriorTrade, 0, len(rows))
	for _, t := range rows {
		if t.ID == d.ID || !t.ClosedAt.Valid || !t.NetPnl.Valid {
			continue
		}
		priors = append(priors, coach.PriorTrade{
			Symbol:    t.Symbol,
			NetPnl:    t.NetPnl.Float64,
			RMultiple: fptr(t.RMultiple),
			Currency:  t.PnlCurrency,
			ClosedAt:  t.ClosedAt.Time,
			Emotion:   emotionByTrade[t.ID],
		})
	}
	session := coach.BuildSessionContext(d.OpenedAt, d.PnlCurrency, priors, loc)
	return &session, nil
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
