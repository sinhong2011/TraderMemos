package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/system"
)

func (s *Server) systemPlanRoutes(g *echo.Group) {
	g.GET("/system/plans", s.handleListSystemPlans)
	g.POST("/system/plans", s.handleCreateSystemPlan)
	g.GET("/system/plans/:id", s.handleGetSystemPlan)
	g.POST("/system/plans/:id/revisions", s.handleAddSystemPlanRevision)
	g.POST("/system/plans/:id/status", s.handleSetSystemPlanStatus)
	g.POST("/system/plans/:id/link", s.handleLinkSystemPlan)
	g.POST("/system/plans/:id/unlink", s.handleUnlinkSystemPlan)
	g.GET("/system/plans/:id/trades", s.handleListSystemPlanTrades)
}

const (
	planPlanned   = "planned"
	planWaiting   = "waiting"
	planTaken     = "taken"
	planSkipped   = "skipped"
	planCancelled = "cancelled"

	maxPlanSymbolLen = 32
	maxPlanTextLen   = 2000
	maxPlanNoteLen   = 500
	maxPlanReasonLen = 500
)

var planAnswers = []string{"", "yes", "no", "na"}

// planTransitions lists the statuses a plan may move to by hand. "taken" is
// reached only by linking a trade, and left only by unlinking it.
var planTransitions = map[string][]string{
	planPlanned:   {planWaiting, planSkipped, planCancelled},
	planWaiting:   {planPlanned, planSkipped, planCancelled},
	planSkipped:   {planPlanned},
	planCancelled: {planPlanned},
}

// --- DTOs ---

type planConditionDTO struct {
	Answer string `json:"answer"`
	Note   string `json:"note"`
}

type planRevisionDTO struct {
	ID           string                      `json:"id"`
	Seq          int64                       `json:"seq"`
	Stage        string                      `json:"stage"`
	Setup        string                      `json:"setup"`
	Thesis       string                      `json:"thesis"`
	Trigger      string                      `json:"trigger"`
	Invalidation string                      `json:"invalidation"`
	EntryPrice   *float64                    `json:"entry_price"`
	StopPrice    *float64                    `json:"stop_price"`
	TargetPrice  *float64                    `json:"target_price"`
	Conditions   map[string]planConditionDTO `json:"conditions"`
	OccurredAt   *time.Time                  `json:"occurred_at"`
	RecordedAt   time.Time                   `json:"recorded_at"`
}

type planTradeDTO struct {
	ID          string     `json:"id"`
	Symbol      string     `json:"symbol"`
	Direction   string     `json:"direction"`
	Status      string     `json:"status"`
	OpenedAt    time.Time  `json:"opened_at"`
	ClosedAt    *time.Time `json:"closed_at"`
	NetPnl      *float64   `json:"net_pnl"`
	PnlCurrency string     `json:"pnl_currency"`
}

type planEventDTO struct {
	ID         string    `json:"id"`
	Kind       string    `json:"kind"`
	FromStatus string    `json:"from_status"`
	ToStatus   string    `json:"to_status"`
	TradeID    string    `json:"trade_id"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
}

type planDTO struct {
	ID           string           `json:"id"`
	VersionID    *string          `json:"version_id"`
	VersionLabel string           `json:"version_label"`
	Symbol       string           `json:"symbol"`
	Direction    string           `json:"direction"`
	Status       string           `json:"status"`
	Source       string           `json:"source"`
	TradeID      *string          `json:"trade_id"`
	Trade        *planTradeDTO    `json:"trade"`
	Latest       *planRevisionDTO `json:"latest"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type planDetailDTO struct {
	planDTO
	Revisions []planRevisionDTO `json:"revisions"`
	Events    []planEventDTO    `json:"events"`
}

type planCandidateDTO struct {
	planTradeDTO
	LinkedPlanID     *string `json:"linked_plan_id"`
	OpenedBeforePlan bool    `json:"opened_before_plan"`
}

type planRevisionInput struct {
	Setup        string                      `json:"setup"`
	Thesis       string                      `json:"thesis"`
	Trigger      string                      `json:"trigger"`
	Invalidation string                      `json:"invalidation"`
	EntryPrice   *float64                    `json:"entry_price"`
	StopPrice    *float64                    `json:"stop_price"`
	TargetPrice  *float64                    `json:"target_price"`
	Conditions   map[string]planConditionDTO `json:"conditions"`
	OccurredAt   *time.Time                  `json:"occurred_at"`
}

// planError carries an HTTP failure out of a transaction closure.
type planError struct {
	status int
	code   string
	msg    string
}

func (e *planError) Error() string { return e.msg }

func planFail(err error, fallback string) error {
	var pe *planError
	if errors.As(err, &pe) {
		return Fail(pe.status, pe.code, pe.msg, nil)
	}
	return Fail(http.StatusInternalServerError, "internal", fallback, nil)
}

// --- mapping ---

func nullStringPtr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}

func revisionFromRow(r store.SystemPlanRevision) planRevisionDTO {
	conds := map[string]planConditionDTO{}
	_ = json.Unmarshal([]byte(r.Conditions), &conds)
	if conds == nil {
		conds = map[string]planConditionDTO{}
	}
	return planRevisionDTO{
		ID: r.ID, Seq: r.Seq, Stage: r.Stage, Setup: r.Setup, Thesis: r.Thesis,
		Trigger: r.TriggerText, Invalidation: r.Invalidation,
		EntryPrice: nullFloatPtr(r.EntryPrice), StopPrice: nullFloatPtr(r.StopPrice),
		TargetPrice: nullFloatPtr(r.TargetPrice), Conditions: conds,
		OccurredAt: nullTimePtr(r.OccurredAt), RecordedAt: r.RecordedAt.UTC(),
	}
}

func planTradeFromRow(t store.Trade) planTradeDTO {
	return planTradeDTO{
		ID: t.ID, Symbol: t.Symbol, Direction: t.Direction, Status: t.Status,
		OpenedAt: t.OpenedAt.UTC(), ClosedAt: nullTimePtr(t.ClosedAt),
		NetPnl: nullFloatPtr(t.NetPnl), PnlCurrency: t.PnlCurrency,
	}
}

func eventFromRow(e store.SystemPlanEvent) planEventDTO {
	return planEventDTO{
		ID: e.ID, Kind: e.Kind, FromStatus: e.FromStatus, ToStatus: e.ToStatus,
		TradeID: e.TradeID, Reason: e.Reason, CreatedAt: e.CreatedAt.UTC(),
	}
}

func (s *Server) planFromRow(ctx context.Context, uid string, p store.SystemPlan, labels map[string]string, latest *store.SystemPlanRevision) planDTO {
	dto := planDTO{
		ID: p.ID, VersionID: nullStringPtr(p.VersionID), Symbol: p.Symbol, Direction: p.Direction,
		Status: p.Status, Source: p.Source, TradeID: nullStringPtr(p.TradeID),
		CreatedAt: p.CreatedAt.UTC(), UpdatedAt: p.UpdatedAt.UTC(),
	}
	if p.VersionID.Valid {
		dto.VersionLabel = labels[p.VersionID.String]
	}
	if p.TradeID.Valid {
		if t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: p.TradeID.String, UserID: uid}); err == nil {
			tr := planTradeFromRow(t)
			dto.Trade = &tr
		}
	}
	if latest != nil {
		rev := revisionFromRow(*latest)
		dto.Latest = &rev
	}
	return dto
}

func (s *Server) versionLabels(ctx context.Context, uid string) (map[string]string, error) {
	versions, err := s.deps.Store.ListSystemVersions(ctx, uid)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(versions))
	for _, v := range versions {
		out[v.ID] = v.Label
	}
	return out, nil
}

func (s *Server) planDetail(ctx context.Context, uid string, p store.SystemPlan) (planDetailDTO, error) {
	labels, err := s.versionLabels(ctx, uid)
	if err != nil {
		return planDetailDTO{}, err
	}
	revs, err := s.deps.Store.ListSystemPlanRevisions(ctx, store.ListSystemPlanRevisionsParams{PlanID: p.ID, UserID: uid})
	if err != nil {
		return planDetailDTO{}, err
	}
	events, err := s.deps.Store.ListSystemPlanEvents(ctx, store.ListSystemPlanEventsParams{PlanID: p.ID, UserID: uid})
	if err != nil {
		return planDetailDTO{}, err
	}
	var latest *store.SystemPlanRevision
	if len(revs) > 0 {
		latest = &revs[len(revs)-1]
	}
	out := planDetailDTO{
		planDTO:   s.planFromRow(ctx, uid, p, labels, latest),
		Revisions: make([]planRevisionDTO, 0, len(revs)),
		Events:    make([]planEventDTO, 0, len(events)),
	}
	for _, r := range revs {
		out.Revisions = append(out.Revisions, revisionFromRow(r))
	}
	for _, e := range events {
		out.Events = append(out.Events, eventFromRow(e))
	}
	return out, nil
}

// --- validation ---

func normalizePlanText(field, v string, max int) (string, error) {
	v = strings.TrimSpace(v)
	if utf8.RuneCountInString(v) > max {
		return "", &planError{http.StatusBadRequest, "bad_request", field + " must be at most " + itoa(max) + " characters"}
	}
	return v, nil
}

func validatePlanPrice(field string, v *float64) error {
	if v != nil && *v <= 0 {
		return &planError{http.StatusBadRequest, "bad_request", field + " must be positive"}
	}
	return nil
}

func (in *planRevisionInput) normalize() error {
	var err error
	if in.Setup, err = normalizePlanText("setup", in.Setup, maxPlanTextLen); err != nil {
		return err
	}
	if in.Thesis, err = normalizePlanText("thesis", in.Thesis, maxPlanTextLen); err != nil {
		return err
	}
	if in.Trigger, err = normalizePlanText("trigger", in.Trigger, maxPlanTextLen); err != nil {
		return err
	}
	if in.Invalidation, err = normalizePlanText("invalidation", in.Invalidation, maxPlanTextLen); err != nil {
		return err
	}
	for field, v := range map[string]*float64{"entry_price": in.EntryPrice, "stop_price": in.StopPrice, "target_price": in.TargetPrice} {
		if err := validatePlanPrice(field, v); err != nil {
			return err
		}
	}
	conds := make(map[string]planConditionDTO, len(in.Conditions))
	for k, c := range in.Conditions {
		if !slices.Contains(system.Decisions, k) {
			return &planError{http.StatusBadRequest, "bad_request", "unknown decision: " + k}
		}
		if !slices.Contains(planAnswers, c.Answer) {
			return &planError{http.StatusBadRequest, "bad_request", "answer must be yes, no, na or empty"}
		}
		note, err := normalizePlanText("note", c.Note, maxPlanNoteLen)
		if err != nil {
			return err
		}
		if c.Answer == "" && note == "" {
			continue
		}
		conds[k] = planConditionDTO{Answer: c.Answer, Note: note}
	}
	in.Conditions = conds
	if in.OccurredAt != nil {
		if in.OccurredAt.After(time.Now().Add(5 * time.Minute)) {
			return &planError{http.StatusBadRequest, "bad_request", "occurred_at cannot be in the future"}
		}
		t := in.OccurredAt.UTC()
		in.OccurredAt = &t
	}
	return nil
}

func insertRevision(ctx context.Context, q store.Querier, uid, planID, stage string, seq int64, in planRevisionInput) (store.SystemPlanRevision, error) {
	var occurred sql.NullTime
	if in.OccurredAt != nil {
		occurred = sql.NullTime{Time: *in.OccurredAt, Valid: true}
	}
	return q.CreateSystemPlanRevision(ctx, store.CreateSystemPlanRevisionParams{
		ID: uuid.NewV7().String(), PlanID: planID, UserID: uid, Seq: seq, Stage: stage,
		Setup: in.Setup, Thesis: in.Thesis, TriggerText: in.Trigger, Invalidation: in.Invalidation,
		EntryPrice: floatPtrNull(in.EntryPrice), StopPrice: floatPtrNull(in.StopPrice),
		TargetPrice: floatPtrNull(in.TargetPrice), Conditions: encodeJSON(in.Conditions),
		OccurredAt: occurred,
	})
}

func insertPlanEvent(ctx context.Context, q store.Querier, uid, planID, kind, from, to, tradeID, reason string) error {
	_, err := q.CreateSystemPlanEvent(ctx, store.CreateSystemPlanEventParams{
		ID: uuid.NewV7().String(), PlanID: planID, UserID: uid, Kind: kind,
		FromStatus: from, ToStatus: to, TradeID: tradeID, Reason: reason,
	})
	return err
}

func (s *Server) loadPlan(ctx context.Context, q store.Querier, uid, id string) (store.SystemPlan, error) {
	p, err := q.GetSystemPlan(ctx, store.GetSystemPlanParams{ID: id, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return p, &planError{http.StatusNotFound, "not_found", "plan not found"}
	}
	return p, err
}

func (s *Server) respondPlan(c *echo.Context, status int, uid string, p store.SystemPlan) error {
	out, err := s.planDetail(c.Request().Context(), uid, p)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the plan", nil)
	}
	return c.JSON(status, out)
}

// --- handlers ---

func (s *Server) handleListSystemPlans(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	plans, err := s.deps.Store.ListSystemPlans(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load plans", nil)
	}
	latest, err := s.deps.Store.ListLatestSystemPlanRevisions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load plans", nil)
	}
	labels, err := s.versionLabels(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load plans", nil)
	}
	byPlan := make(map[string]*store.SystemPlanRevision, len(latest))
	for i := range latest {
		byPlan[latest[i].PlanID] = &latest[i]
	}
	out := make([]planDTO, 0, len(plans))
	for _, p := range plans {
		out = append(out, s.planFromRow(ctx, uid, p, labels, byPlan[p.ID]))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleCreateSystemPlan(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in struct {
		Symbol    string            `json:"symbol"`
		Direction string            `json:"direction"`
		Source    string            `json:"source"`
		Revision  planRevisionInput `json:"revision"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	symbol := strings.ToUpper(strings.TrimSpace(in.Symbol))
	if symbol == "" || utf8.RuneCountInString(symbol) > maxPlanSymbolLen {
		return Fail(http.StatusBadRequest, "bad_request", "symbol is required (at most 32 characters)", nil)
	}
	if in.Direction != "long" && in.Direction != "short" {
		return Fail(http.StatusBadRequest, "bad_request", "direction must be long or short", nil)
	}
	if in.Source == "" {
		in.Source = "live"
	}
	if in.Source != "live" && in.Source != "retrospective" {
		return Fail(http.StatusBadRequest, "bad_request", "source must be live or retrospective", nil)
	}
	if err := in.Revision.normalize(); err != nil {
		return planFail(err, "invalid revision")
	}
	if in.Source == "retrospective" && in.Revision.OccurredAt == nil {
		return Fail(http.StatusBadRequest, "bad_request", "a retrospective plan needs occurred_at", nil)
	}
	active, err := s.deps.Store.GetActiveSystemVersion(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusConflict, "no_active_version", "activate a system version before planning trades", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the active version", nil)
	}

	var plan store.SystemPlan
	err = store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		var err error
		plan, err = q.CreateSystemPlan(ctx, store.CreateSystemPlanParams{
			ID: uuid.NewV7().String(), UserID: uid, VersionID: sql.NullString{String: active.ID, Valid: true},
			Symbol: symbol, Direction: in.Direction, Source: in.Source,
		})
		if err != nil {
			return err
		}
		if _, err := insertRevision(ctx, q, uid, plan.ID, "before_fill", 1, in.Revision); err != nil {
			return err
		}
		return insertPlanEvent(ctx, q, uid, plan.ID, "status", "", planPlanned, "", "")
	})
	if err != nil {
		return planFail(err, "could not create the plan")
	}
	return s.respondPlan(c, http.StatusCreated, uid, plan)
}

func (s *Server) handleGetSystemPlan(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	p, err := s.loadPlan(ctx, s.deps.Store, uid, c.Param("id"))
	if err != nil {
		return planFail(err, "could not load the plan")
	}
	return s.respondPlan(c, http.StatusOK, uid, p)
}

// handleAddSystemPlanRevision appends a revision. Earlier revisions are never
// rewritten, so what was recorded before the fill stays readable after it.
func (s *Server) handleAddSystemPlanRevision(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in planRevisionInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := in.normalize(); err != nil {
		return planFail(err, "invalid revision")
	}
	var plan store.SystemPlan
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		var err error
		plan, err = s.loadPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		if plan.Status == planSkipped || plan.Status == planCancelled {
			return &planError{http.StatusConflict, "plan_closed", "reopen the plan before revising it"}
		}
		seq, err := q.MaxSystemPlanRevisionSeq(ctx, store.MaxSystemPlanRevisionSeqParams{PlanID: plan.ID, UserID: uid})
		if err != nil {
			return err
		}
		stage := "before_fill"
		if plan.Status == planTaken {
			stage = "after_fill"
		}
		if _, err := insertRevision(ctx, q, uid, plan.ID, stage, seq+1, in); err != nil {
			return err
		}
		return q.TouchSystemPlan(ctx, store.TouchSystemPlanParams{ID: plan.ID, UserID: uid})
	})
	if err != nil {
		return planFail(err, "could not save the revision")
	}
	return s.respondPlan(c, http.StatusCreated, uid, plan)
}

func (s *Server) handleSetSystemPlanStatus(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	reason, err := normalizePlanText("reason", in.Reason, maxPlanReasonLen)
	if err != nil {
		return planFail(err, "invalid reason")
	}
	var plan store.SystemPlan
	err = store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		cur, err := s.loadPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		if !slices.Contains(planTransitions[cur.Status], in.Status) {
			return &planError{http.StatusConflict, "invalid_transition", "a " + cur.Status + " plan cannot become " + in.Status}
		}
		closing := in.Status == planSkipped || in.Status == planCancelled
		reopening := cur.Status == planSkipped || cur.Status == planCancelled
		if (closing || reopening) && reason == "" {
			return &planError{http.StatusBadRequest, "bad_request", "a reason is required"}
		}
		plan, err = q.UpdateSystemPlanStatus(ctx, store.UpdateSystemPlanStatusParams{Status: in.Status, ID: cur.ID, UserID: uid})
		if err != nil {
			return err
		}
		return insertPlanEvent(ctx, q, uid, cur.ID, "status", cur.Status, in.Status, "", reason)
	})
	if err != nil {
		return planFail(err, "could not change the status")
	}
	return s.respondPlan(c, http.StatusOK, uid, plan)
}

func (s *Server) handleLinkSystemPlan(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in struct {
		TradeID string `json:"trade_id"`
	}
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.TradeID) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "trade_id is required", nil)
	}
	var plan store.SystemPlan
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		cur, err := s.loadPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		if cur.Status != planPlanned && cur.Status != planWaiting {
			return &planError{http.StatusConflict, "invalid_transition", "only a planned or waiting plan can be linked"}
		}
		trade, err := q.GetTrade(ctx, store.GetTradeParams{ID: in.TradeID, UserID: uid})
		if errors.Is(err, sql.ErrNoRows) {
			return &planError{http.StatusNotFound, "not_found", "trade not found"}
		}
		if err != nil {
			return err
		}
		tid := sql.NullString{String: trade.ID, Valid: true}
		if other, err := q.GetSystemPlanByTrade(ctx, store.GetSystemPlanByTradeParams{TradeID: tid, UserID: uid}); err == nil && other.ID != cur.ID {
			return &planError{http.StatusConflict, "trade_linked", "this trade already confirms another plan"}
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		plan, err = q.SetSystemPlanTrade(ctx, store.SetSystemPlanTradeParams{TradeID: tid, Status: planTaken, ID: cur.ID, UserID: uid})
		if isUniqueConstraint(err) {
			return &planError{http.StatusConflict, "trade_linked", "this trade already confirms another plan"}
		}
		if err != nil {
			return err
		}
		return insertPlanEvent(ctx, q, uid, cur.ID, "link", cur.Status, planTaken, trade.ID, "")
	})
	if err != nil {
		return planFail(err, "could not link the trade")
	}
	return s.respondPlan(c, http.StatusOK, uid, plan)
}

func (s *Server) handleUnlinkSystemPlan(c *echo.Context) error {
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
		cur, err := s.loadPlan(ctx, q, uid, c.Param("id"))
		if err != nil {
			return err
		}
		if cur.Status != planTaken {
			return &planError{http.StatusConflict, "invalid_transition", "only a taken plan can be unlinked"}
		}
		plan, err = q.SetSystemPlanTrade(ctx, store.SetSystemPlanTradeParams{Status: planWaiting, ID: cur.ID, UserID: uid})
		if err != nil {
			return err
		}
		return insertPlanEvent(ctx, q, uid, cur.ID, "unlink", planTaken, planWaiting, cur.TradeID.String, reason)
	})
	if err != nil {
		return planFail(err, "could not unlink the trade")
	}
	return s.respondPlan(c, http.StatusOK, uid, plan)
}

// handleListSystemPlanTrades lists same-symbol trades the user may confirm
// as this plan's fill. Linking is always an explicit choice; nothing is
// matched automatically.
func (s *Server) handleListSystemPlanTrades(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	plan, err := s.loadPlan(ctx, s.deps.Store, uid, c.Param("id"))
	if err != nil {
		return planFail(err, "could not load the plan")
	}
	trades, err := s.deps.Store.ListTradesBySymbol(ctx, store.ListTradesBySymbolParams{UserID: uid, Symbol: plan.Symbol})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trades", nil)
	}
	plans, err := s.deps.Store.ListSystemPlans(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load plans", nil)
	}
	linked := map[string]string{}
	for _, p := range plans {
		if p.TradeID.Valid {
			linked[p.TradeID.String] = p.ID
		}
	}
	out := make([]planCandidateDTO, 0, len(trades))
	for _, t := range trades {
		cand := planCandidateDTO{planTradeDTO: planTradeFromRow(t), OpenedBeforePlan: t.OpenedAt.Before(plan.CreatedAt)}
		if pid, ok := linked[t.ID]; ok {
			cand.LinkedPlanID = &pid
		}
		out = append(out, cand)
	}
	return c.JSON(http.StatusOK, out)
}
