package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/coach"
	"github.com/tradermemos/api/internal/store"
)

type coachReviewDTO struct {
	Source     string       `json:"source"` // llm | off | error
	Notes      []coach.Note `json:"notes"`
	NextAction string       `json:"next_action,omitempty"`
	Error      string       `json:"error,omitempty"`
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
	// A failed history lookup degrades the review rather than failing it: the
	// single-trade brief is still worth generating. Whatever was built before
	// the error is kept, so a risk-rules failure still leaves the session block.
	hist, herr := s.coachHistoryFor(ctx, uid, detail, coachLoc(c))
	if herr != nil {
		c.Logger().Warn("coach history context incomplete", "trade_id", tradeID, "err", herr)
	}
	tradeCtx.Session = hist.session
	tradeCtx.Execution = hist.execution

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
	return c.JSON(http.StatusOK, coachReviewDTO{
		Source:     "llm",
		Notes:      review.Notes,
		NextAction: review.NextAction,
	})
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

// coachHistory is the cross-trade context for one review: where the trader
// stood when the trade was entered, and how well the trade itself executed.
type coachHistory struct {
	session   *coach.SessionContext
	execution *coach.ExecutionContext
}

// coachHistoryFor builds both from a single pass over the account's closed
// trades — the two contexts need the same rows, so they share the queries.
func (s *Server) coachHistoryFor(
	ctx context.Context,
	userID string,
	d tradeDetailDTO,
	loc *time.Location,
) (coachHistory, error) {
	rows, err := s.deps.Store.ListClosedTrades(ctx, store.ListClosedTradesParams{
		UserID:    userID,
		AccountID: d.AccountID,
	})
	if err != nil {
		return coachHistory{}, err
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return coachHistory{}, err
	}
	emotionByTrade := make(map[string]string, len(journals))
	journalByTrade := make(map[string]store.TradeJournal, len(journals))
	for _, j := range journals {
		journalByTrade[j.TradeID] = j
		if e := strings.TrimSpace(j.EmotionalState); e != "" {
			emotionByTrade[j.TradeID] = e
		}
	}

	priors := make([]coach.PriorTrade, 0, len(rows))
	scoreTrades := make([]analytics.ScoreTrade, 0, len(rows))
	for _, t := range rows {
		if !t.ClosedAt.Valid || !t.NetPnl.Valid {
			continue
		}
		// The reviewed trade is excluded from the priors (it is not its own
		// history) but included in the scoring set (it is what we are scoring).
		if t.ID != d.ID {
			priors = append(priors, coach.PriorTrade{
				Symbol:    t.Symbol,
				NetPnl:    t.NetPnl.Float64,
				RMultiple: fptr(t.RMultiple),
				Currency:  t.PnlCurrency,
				ClosedAt:  t.ClosedAt.Time,
				Emotion:   emotionByTrade[t.ID],
			})
		}
		j := journalByTrade[t.ID]
		st := analytics.ScoreTrade{
			ID:       t.ID,
			Symbol:   t.Symbol,
			NetPnl:   t.NetPnl.Float64,
			OpenedAt: t.OpenedAt,
			ClosedAt: t.ClosedAt.Time,
			Mae:      fptr(j.Mae),
			Mfe:      fptr(j.Mfe),
		}
		if j.InitialRisk.Valid {
			st.InitialRisk = j.InitialRisk.Float64
		}
		scoreTrades = append(scoreTrades, st)
	}

	session := coach.BuildSessionContext(d.OpenedAt, d.PnlCurrency, priors, loc)
	out := coachHistory{session: &session}

	rules, err := s.coachRiskRules(ctx, userID)
	if err != nil {
		return out, err
	}
	axes, ok := analytics.TradeAxesFor(
		d.ID, scoreTrades, rules, analytics.DefaultExecScoreConfig(), loc,
	)
	if ok {
		out.execution = &coach.ExecutionContext{
			Entry:           axes.Entry,
			Exit:            axes.Exit,
			Risk:            axes.Risk,
			Tempo:           axes.Tempo,
			QuickReentry:    axes.QuickReentry,
			Overtraded:      axes.Overtraded,
			RiskRecorded:    axes.RiskRecorded,
			OverMaxRisk:     axes.OverMaxRisk,
			DailyLossBreach: axes.DailyLossBreach,
			RulesConfigured: axes.RulesConfigured,
		}
	}
	return out, nil
}

// coachRiskRules loads the enforceable risk rules; an unconfigured user is
// not an error, they simply score on risk definition alone.
func (s *Server) coachRiskRules(ctx context.Context, userID string) (analytics.ComplianceRules, error) {
	row, err := s.deps.Store.GetRiskRules(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return analytics.ComplianceRules{}, nil
	}
	if err != nil {
		return analytics.ComplianceRules{}, err
	}
	var rules analytics.ComplianceRules
	if row.MaxRiskPerTrade.Valid {
		rules.MaxRiskPerTrade = row.MaxRiskPerTrade.Float64
	}
	if row.MaxDailyLoss.Valid {
		rules.MaxDailyLoss = row.MaxDailyLoss.Float64
	}
	return rules, nil
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
