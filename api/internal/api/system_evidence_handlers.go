package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/system"
	"uuid"
)

const (
	evidenceSupport   = "support"
	evidenceWeaken    = "weaken"
	evidenceUncertain = "uncertain"

	evidenceWrong        = "wrong"
	evidenceStillWorking = "still_working"
	evidenceNotWorking   = "not_working"
	evidenceFinished     = "finished"

	evidenceHold       = "hold"
	evidenceAdd        = "add"
	evidenceTrim       = "trim"
	evidenceTakeProfit = "take_profit"
	evidenceExit       = "exit"
)

var (
	evidenceStances = []string{evidenceSupport, evidenceWeaken, evidenceUncertain}
	evidenceStates  = []string{evidenceWrong, evidenceStillWorking, evidenceNotWorking, evidenceFinished}
	evidenceActions = []string{evidenceHold, evidenceAdd, evidenceTrim, evidenceTakeProfit, evidenceExit}
)

type evidenceRevisionDTO struct {
	ID         string     `json:"id"`
	Seq        int64      `json:"seq"`
	DecisionID string     `json:"decision_id"`
	Stance     string     `json:"stance"`
	Body       string     `json:"body"`
	State      string     `json:"state"`
	Action     string     `json:"action"`
	Source     string     `json:"source"`
	OccurredAt *time.Time `json:"occurred_at"`
	RecordedAt time.Time  `json:"recorded_at"`
}

type evidenceEntryDTO struct {
	ID             string                `json:"id"`
	WithdrawnAt    *time.Time            `json:"withdrawn_at"`
	WithdrawReason string                `json:"withdraw_reason"`
	CreatedAt      time.Time             `json:"created_at"`
	Latest         *evidenceRevisionDTO  `json:"latest"`
	Revisions      []evidenceRevisionDTO `json:"revisions"`
}

type evidencePromptDTO struct {
	Kind  string    `json:"kind"`
	DueAt time.Time `json:"due_at"`
}

type evidenceListDTO struct {
	Entries     []evidenceEntryDTO `json:"entries"`
	ScalingRule string             `json:"scaling_rule"`
	Prompt      *evidencePromptDTO `json:"prompt"`
}

type evidenceInput struct {
	DecisionID string     `json:"decision_id"`
	Stance     string     `json:"stance"`
	Body       string     `json:"body"`
	State      string     `json:"state"`
	Action     string     `json:"action"`
	Source     string     `json:"source"`
	OccurredAt *time.Time `json:"occurred_at"`
}

func (in *evidenceInput) normalize() error {
	if !slices.Contains(system.Decisions, in.DecisionID) {
		return &planError{http.StatusBadRequest, "bad_request", "unknown decision"}
	}
	if !slices.Contains(evidenceStances, in.Stance) {
		return &planError{http.StatusBadRequest, "bad_request", "stance must be support, weaken, or uncertain"}
	}
	if !slices.Contains(evidenceStates, in.State) {
		return &planError{http.StatusBadRequest, "bad_request", "invalid state"}
	}
	if !slices.Contains(evidenceActions, in.Action) {
		return &planError{http.StatusBadRequest, "bad_request", "invalid action"}
	}
	if in.Source == "" {
		in.Source = "live"
	}
	if in.Source != "live" && in.Source != "retrospective" {
		return &planError{http.StatusBadRequest, "bad_request", "source must be live or retrospective"}
	}
	var err error
	if in.Body, err = normalizePlanText("body", in.Body, maxPlanTextLen); err != nil {
		return err
	}
	if in.Body == "" {
		return &planError{http.StatusBadRequest, "bad_request", "evidence text is required"}
	}
	if in.Source == "retrospective" && in.OccurredAt == nil {
		return &planError{http.StatusBadRequest, "bad_request", "a retrospective note needs occurred_at"}
	}
	if in.OccurredAt != nil && in.OccurredAt.After(time.Now().Add(5*time.Minute)) {
		return &planError{http.StatusBadRequest, "bad_request", "occurred_at cannot be in the future"}
	}
	return nil
}

func evidenceRevisionFromRow(r store.SystemPlanEvidenceRevision) evidenceRevisionDTO {
	var occurred *time.Time
	if r.OccurredAt.Valid {
		t := r.OccurredAt.Time
		occurred = &t
	}
	return evidenceRevisionDTO{
		ID: r.ID, Seq: r.Seq, DecisionID: r.DecisionID, Stance: r.Stance, Body: r.Body,
		State: r.State, Action: r.Action, Source: r.Source, OccurredAt: occurred, RecordedAt: r.RecordedAt,
	}
}

func (s *Server) evidenceList(ctx context.Context, q store.Querier, uid string, plan store.SystemPlan) (evidenceListDTO, error) {
	rows, err := q.ListSystemPlanEvidence(ctx, store.ListSystemPlanEvidenceParams{PlanID: plan.ID, UserID: uid})
	if err != nil {
		return evidenceListDTO{}, err
	}
	revs, err := q.ListSystemPlanEvidenceRevisions(ctx, store.ListSystemPlanEvidenceRevisionsParams{PlanID: plan.ID, UserID: uid})
	if err != nil {
		return evidenceListDTO{}, err
	}
	byID := map[string][]evidenceRevisionDTO{}
	for _, r := range revs {
		byID[r.EvidenceID] = append(byID[r.EvidenceID], evidenceRevisionFromRow(r))
	}
	entries := make([]evidenceEntryDTO, 0, len(rows))
	for _, row := range rows {
		list := byID[row.ID]
		if list == nil {
			list = []evidenceRevisionDTO{}
		}
		entry := evidenceEntryDTO{
			ID: row.ID, WithdrawReason: row.WithdrawReason, CreatedAt: row.CreatedAt, Revisions: list,
		}
		if row.WithdrawnAt.Valid {
			t := row.WithdrawnAt.Time
			entry.WithdrawnAt = &t
		}
		if n := len(list); n > 0 {
			latest := list[n-1]
			entry.Latest = &latest
		}
		entries = append(entries, entry)
	}
	out := evidenceListDTO{Entries: entries, ScalingRule: s.scalingRule(ctx, q, uid, plan.VersionID)}
	if plan.TradeID.Valid {
		out.Prompt = s.holdingPrompt(ctx, q, uid, plan.TradeID.String)
	}
	return out, nil
}

func (s *Server) scalingRule(ctx context.Context, q store.Querier, uid string, versionID sql.NullString) string {
	if !versionID.Valid {
		return ""
	}
	v, err := q.GetSystemVersion(ctx, store.GetSystemVersionParams{ID: versionID.String, UserID: uid})
	if err != nil {
		return ""
	}
	return decodeRules(v.Rules)[system.DecScaling].Text
}

// holdingPrompt asks the author to confirm a due time stop or planned hold.
// It never writes a record and never treats the deadline as an exit.
func (s *Server) holdingPrompt(ctx context.Context, q store.Querier, uid, tradeID string) *evidencePromptDTO {
	trade, err := q.GetTrade(ctx, store.GetTradeParams{ID: tradeID, UserID: uid})
	if err != nil {
		return nil
	}
	card, err := q.GetTradeSystemCard(ctx, store.GetTradeSystemCardParams{TradeID: tradeID, UserID: uid})
	if err != nil {
		return nil
	}
	now := time.Now()
	if card.TimeStopDays.Valid && card.TimeStopDays.Int64 > 0 {
		due := trade.OpenedAt.AddDate(0, 0, int(card.TimeStopDays.Int64))
		if !now.Before(due) {
			return &evidencePromptDTO{Kind: "time_stop", DueAt: due}
		}
	}
	if card.PlannedHoldDays.Valid && card.PlannedHoldDays.Int64 > 0 {
		due := trade.OpenedAt.AddDate(0, 0, int(card.PlannedHoldDays.Int64))
		if !now.Before(due) {
			return &evidencePromptDTO{Kind: "planned_hold", DueAt: due}
		}
	}
	return nil
}

func (s *Server) handleListSystemPlanEvidence(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	plan, err := s.loadPlan(ctx, s.deps.Store, uid, c.Param("id"))
	if err != nil {
		return planFail(err, "could not load the plan")
	}
	out, err := s.evidenceList(ctx, s.deps.Store, uid, plan)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load evidence", nil)
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) requireTakenPlan(ctx context.Context, q store.Querier, uid, planID string) (store.SystemPlan, error) {
	plan, err := s.loadPlan(ctx, q, uid, planID)
	if err != nil {
		return store.SystemPlan{}, err
	}
	if plan.Status != planTaken {
		return store.SystemPlan{}, &planError{http.StatusConflict, "plan_not_taken", "link a trade before recording what you saw while holding"}
	}
	return plan, nil
}

func insertEvidenceRevision(ctx context.Context, q store.Querier, uid, evidenceID string, seq int64, in evidenceInput) error {
	var occurred sql.NullTime
	if in.OccurredAt != nil {
		occurred = sql.NullTime{Time: in.OccurredAt.UTC(), Valid: true}
	}
	_, err := q.CreateSystemPlanEvidenceRevision(ctx, store.CreateSystemPlanEvidenceRevisionParams{
		ID: uuid.NewV7().String(), EvidenceID: evidenceID, UserID: uid, Seq: seq,
		DecisionID: in.DecisionID, Stance: in.Stance, Body: in.Body, State: in.State,
		Action: in.Action, Source: in.Source, OccurredAt: occurred,
	})
	return err
}

func (s *Server) handleCreateSystemPlanEvidence(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in evidenceInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := in.normalize(); err != nil {
		return planFail(err, "invalid evidence")
	}
	var plan store.SystemPlan
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		var err error
		plan, err = s.requireTakenPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		row, err := q.CreateSystemPlanEvidence(ctx, store.CreateSystemPlanEvidenceParams{
			ID: uuid.NewV7().String(), PlanID: plan.ID, UserID: uid,
		})
		if err != nil {
			return err
		}
		return insertEvidenceRevision(ctx, q, uid, row.ID, 1, in)
	})
	if err != nil {
		return planFail(err, "could not record the evidence")
	}
	out, err := s.evidenceList(ctx, s.deps.Store, uid, plan)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load evidence", nil)
	}
	return c.JSON(http.StatusCreated, out)
}

func (s *Server) handleAddSystemPlanEvidenceRevision(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in evidenceInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := in.normalize(); err != nil {
		return planFail(err, "invalid evidence")
	}
	var plan store.SystemPlan
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		var err error
		plan, err = s.requireTakenPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		row, err := q.GetSystemPlanEvidence(ctx, store.GetSystemPlanEvidenceParams{ID: c.Param("eid"), UserID: uid})
		if errors.Is(err, sql.ErrNoRows) || (err == nil && row.PlanID != plan.ID) {
			return &planError{http.StatusNotFound, "not_found", "evidence not found"}
		}
		if err != nil {
			return err
		}
		if row.WithdrawnAt.Valid {
			return &planError{http.StatusConflict, "evidence_withdrawn", "a withdrawn note cannot be corrected"}
		}
		seq, err := q.MaxSystemPlanEvidenceRevisionSeq(ctx, store.MaxSystemPlanEvidenceRevisionSeqParams{EvidenceID: row.ID, UserID: uid})
		if err != nil {
			return err
		}
		return insertEvidenceRevision(ctx, q, uid, row.ID, seq+1, in)
	})
	if err != nil {
		return planFail(err, "could not correct the evidence")
	}
	out, err := s.evidenceList(ctx, s.deps.Store, uid, plan)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load evidence", nil)
	}
	return c.JSON(http.StatusCreated, out)
}

func (s *Server) handleWithdrawSystemPlanEvidence(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in struct {
		Reason string `json:"reason"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	reason, err := normalizePlanText("reason", in.Reason, maxPlanReasonLen)
	if err != nil {
		return planFail(err, "invalid reason")
	}
	if reason == "" {
		return Fail(http.StatusBadRequest, "bad_request", "a reason is required", nil)
	}
	var plan store.SystemPlan
	err = store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		var err error
		plan, err = s.loadPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		row, err := q.GetSystemPlanEvidence(ctx, store.GetSystemPlanEvidenceParams{ID: c.Param("eid"), UserID: uid})
		if errors.Is(err, sql.ErrNoRows) || (err == nil && row.PlanID != plan.ID) {
			return &planError{http.StatusNotFound, "not_found", "evidence not found"}
		}
		if err != nil {
			return err
		}
		if row.WithdrawnAt.Valid {
			return &planError{http.StatusConflict, "evidence_withdrawn", "this note is already withdrawn"}
		}
		_, err = q.WithdrawSystemPlanEvidence(ctx, store.WithdrawSystemPlanEvidenceParams{
			WithdrawReason: reason, ID: row.ID, UserID: uid,
		})
		if errors.Is(err, sql.ErrNoRows) {
			return &planError{http.StatusConflict, "evidence_withdrawn", "this note is already withdrawn"}
		}
		return err
	})
	if err != nil {
		return planFail(err, "could not withdraw the evidence")
	}
	out, err := s.evidenceList(ctx, s.deps.Store, uid, plan)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load evidence", nil)
	}
	return c.JSON(http.StatusOK, out)
}
