package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/cooldown"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) cooldownRoutes(g *echo.Group) {
	g.GET("/cooldowns/active", s.handleActiveCooldown)
	g.GET("/cooldowns", s.handleListCooldowns)
	g.POST("/cooldowns", s.handleStartCooldown)
	g.POST("/cooldowns/:id/extend", s.handleExtendCooldown)
	g.POST("/cooldowns/:id/release", s.handleReleaseCooldown)
	g.GET("/analytics/cooldowns", s.handleCooldownStats)
}

type cooldownDTO struct {
	ID            string     `json:"id"`
	StartedAt     time.Time  `json:"started_at"`
	EndsAt        time.Time  `json:"ends_at"`
	DurationSec   int64      `json:"duration_sec"`
	Trigger       string     `json:"trigger"`
	Impulse       string     `json:"impulse"`
	Phase         string     `json:"phase"`
	ReleasedAt    *time.Time `json:"released_at"`
	ReleasedEarly bool       `json:"released_early"`
	SetupID       *string    `json:"setup_id"`
	ReturnRule    string     `json:"return_rule"`
	Reflection    string     `json:"reflection"`
}

func toCooldownDTO(r store.CooldownSession, now time.Time) cooldownDTO {
	sess := cooldown.FromStore(r)
	return cooldownDTO{
		ID:            r.ID,
		StartedAt:     r.StartedAt,
		EndsAt:        r.EndsAt,
		DurationSec:   int64(r.EndsAt.Sub(r.StartedAt).Seconds()),
		Trigger:       r.Trigger,
		Impulse:       r.Impulse,
		Phase:         sess.Phase(now),
		ReleasedAt:    tptr(r.ReleasedAt),
		ReleasedEarly: sess.ReleasedEarly,
		SetupID:       sptr(r.SetupID),
		ReturnRule:    r.ReturnRule,
		Reflection:    r.Reflection,
	}
}

// cooldownEnabled reports whether the trader has switched cooldown mode on
// (risk_rules.cooldown_enabled). Off is the default, and a user with no risk
// rules row at all has never turned it on.
func (s *Server) cooldownEnabled(ctx context.Context, uid string) (bool, error) {
	rules, err := s.deps.Store.GetRiskRules(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return rules.CooldownEnabled != 0, nil
}

// openCooldown returns the user's open session, or nil when none locks them.
// Switching the feature off releases the lock: a session nobody can see must
// not keep the trade form shut.
func (s *Server) openCooldown(c *echo.Context, uid string, now time.Time) (*store.CooldownSession, error) {
	if on, err := s.cooldownEnabled(c.Request().Context(), uid); err != nil || !on {
		return nil, err
	}
	row, err := s.deps.Store.GetOpenCooldownSession(c.Request().Context(), uid)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !cooldown.FromStore(row).Open(now) {
		return nil, nil
	}
	return &row, nil
}

// handleActiveCooldown answers {"session": dto|null} — the poll every client
// gate runs on.
func (s *Server) handleActiveCooldown(c *echo.Context) error {
	now := time.Now().UTC()
	row, err := s.openCooldown(c, auth.UserID(c), now)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldown", nil)
	}
	out := struct {
		Session *cooldownDTO `json:"session"`
	}{}
	if row != nil {
		dto := toCooldownDTO(*row, now)
		out.Session = &dto
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleListCooldowns(c *echo.Context) error {
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	now := time.Now().UTC()
	rows, err := s.deps.Store.ListCooldownSessions(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldowns", nil)
	}
	out := make([]cooldownDTO, 0, len(rows))
	for _, r := range rows {
		if (f.From != nil && r.StartedAt.Before(*f.From)) || (f.To != nil && r.StartedAt.After(*f.To)) {
			continue
		}
		out = append(out, toCooldownDTO(r, now))
	}
	return c.JSON(http.StatusOK, out)
}

type startCooldownBody struct {
	DurationSec int64  `json:"duration_sec"`
	Trigger     string `json:"trigger"`
	Impulse     string `json:"impulse"`
}

func (s *Server) handleStartCooldown(c *echo.Context) error {
	uid := auth.UserID(c)
	var in startCooldownBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	dur := time.Duration(in.DurationSec) * time.Second
	if dur < cooldown.MinDuration || dur > cooldown.MaxDuration {
		return Fail(http.StatusBadRequest, "bad_request", "duration_sec must be between 60 and 86400", nil)
	}
	if in.Trigger == "" {
		in.Trigger = cooldown.TriggerManual
	}
	if !cooldown.ValidTrigger(in.Trigger) {
		return Fail(http.StatusBadRequest, "bad_request", "unknown trigger", nil)
	}
	if !cooldown.ValidImpulse(in.Impulse) {
		return Fail(http.StatusBadRequest, "bad_request", "unknown impulse", nil)
	}
	now := time.Now().UTC()
	if on, err := s.cooldownEnabled(c.Request().Context(), uid); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	} else if !on {
		return Fail(http.StatusForbidden, "cooldown_disabled",
			"cooldown mode is off — turn it on in Settings before starting one", nil)
	}
	if open, err := s.openCooldown(c, uid, now); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldown", nil)
	} else if open != nil {
		return Fail(http.StatusConflict, "cooldown_active", "a cooldown is already running", toCooldownDTO(*open, now))
	}
	row, err := s.deps.Store.CreateCooldownSession(c.Request().Context(), store.CreateCooldownSessionParams{
		ID:        uuid.New().String(),
		UserID:    uid,
		StartedAt: now,
		EndsAt:    now.Add(dur),
		Trigger:   in.Trigger,
		Impulse:   in.Impulse,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not start cooldown", nil)
	}
	return c.JSON(http.StatusCreated, toCooldownDTO(row, now))
}

// handleExtendCooldown adds time to a running session. Adding to a session
// already at its gate restarts the clock from now.
func (s *Server) handleExtendCooldown(c *echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		DurationSec int64 `json:"duration_sec"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	dur := time.Duration(in.DurationSec) * time.Second
	if dur < cooldown.MinDuration || dur > cooldown.MaxDuration {
		return Fail(http.StatusBadRequest, "bad_request", "duration_sec must be between 60 and 86400", nil)
	}
	ctx := c.Request().Context()
	row, err := s.deps.Store.GetCooldownSession(ctx, store.GetCooldownSessionParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "cooldown not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldown", nil)
	}
	now := time.Now().UTC()
	if !cooldown.FromStore(row).Open(now) {
		return Fail(http.StatusConflict, "cooldown_closed", "this cooldown is over", nil)
	}
	base := row.EndsAt
	if base.Before(now) {
		base = now
	}
	if base.Add(dur).Sub(row.StartedAt) > cooldown.MaxDuration {
		return Fail(http.StatusBadRequest, "bad_request", "a cooldown cannot run longer than 24 hours", nil)
	}
	updated, err := s.deps.Store.ExtendCooldownSession(ctx, store.ExtendCooldownSessionParams{
		EndsAt: base.Add(dur), ID: row.ID, UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not extend cooldown", nil)
	}
	return c.JSON(http.StatusOK, toCooldownDTO(updated, now))
}

type releaseCooldownBody struct {
	Impulse    string  `json:"impulse"`
	SetupID    *string `json:"setup_id"`
	ReturnRule string  `json:"return_rule"`
	Reflection string  `json:"reflection"`
}

func (s *Server) handleReleaseCooldown(c *echo.Context) error {
	uid := auth.UserID(c)
	var in releaseCooldownBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	ctx := c.Request().Context()
	row, err := s.deps.Store.GetCooldownSession(ctx, store.GetCooldownSessionParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "cooldown not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldown", nil)
	}
	now := time.Now().UTC()
	if in.ReturnRule == "" {
		in.ReturnRule = cooldown.RuleNone
	}
	rel := cooldown.Release{
		Impulse:    in.Impulse,
		ReturnRule: in.ReturnRule,
		Reflection: strings.TrimSpace(in.Reflection),
	}
	setup := sql.NullString{}
	if in.SetupID != nil && *in.SetupID != "" {
		if _, serr := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: *in.SetupID, UserID: uid}); serr != nil {
			if errors.Is(serr, sql.ErrNoRows) {
				return Fail(http.StatusBadRequest, "bad_request", "setup_id not found", nil)
			}
			return Fail(http.StatusInternalServerError, "internal", "could not load setup", nil)
		}
		setup = sql.NullString{String: *in.SetupID, Valid: true}
		rel.SetupID = *in.SetupID
	}
	early, verr := cooldown.ValidateRelease(cooldown.FromStore(row), rel, now)
	if verr != nil {
		if row.ReleasedAt.Valid {
			return Fail(http.StatusConflict, "cooldown_closed", verr.Error(), nil)
		}
		return Fail(http.StatusBadRequest, "bad_request", verr.Error(), nil)
	}
	var earlyFlag int64
	if early {
		earlyFlag = 1
	}
	updated, err := s.deps.Store.ReleaseCooldownSession(ctx, store.ReleaseCooldownSessionParams{
		ReleasedAt:    sql.NullTime{Time: now, Valid: true},
		ReleasedEarly: earlyFlag,
		Impulse:       rel.Impulse,
		SetupID:       setup,
		ReturnRule:    rel.ReturnRule,
		Reflection:    rel.Reflection,
		ID:            row.ID,
		UserID:        uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not release cooldown", nil)
	}
	return c.JSON(http.StatusOK, toCooldownDTO(updated, now))
}

// handleCooldownStats scores the user's cooldowns against the trades taken
// around them, over the shared filter range.
func (s *Server) handleCooldownStats(c *echo.Context) error {
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	ctx := c.Request().Context()
	rows, err := s.deps.Store.ListCooldownSessions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cooldowns", nil)
	}
	sessions := make([]cooldown.Session, 0, len(rows))
	for _, r := range rows {
		if (f.From != nil && r.StartedAt.Before(*f.From)) || (f.To != nil && r.StartedAt.After(*f.To)) {
			continue
		}
		sessions = append(sessions, cooldown.FromStore(r))
	}
	tradeRows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not load trades")
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
	trades := make([]cooldown.Trade, 0, len(tradeRows))
	for _, t := range tradeRows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		trades = append(trades, cooldown.Trade{
			NetPnl: t.NetPnl.Float64, OpenedAt: t.OpenedAt, ClosedAt: t.ClosedAt.Time,
			InitialRisk: riskByTrade[t.ID],
		})
	}
	streakN, maxRisk := 0, 0.0
	if rules, rerr := s.deps.Store.GetRiskRules(ctx, uid); rerr == nil {
		if rules.MaxConsecutiveLosses.Valid {
			streakN = int(rules.MaxConsecutiveLosses.Int64)
		}
		if rules.MaxRiskPerTrade.Valid {
			maxRisk = rules.MaxRiskPerTrade.Float64
		}
	} else if !errors.Is(rerr, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}
	return c.JSON(http.StatusOK, cooldown.Compute(sessions, trades, streakN, maxRisk, f.Loc))
}

// returnCommitments lists the return rules the user made, for compliance
// scoring: each is a moment after which that day's trades are held to it.
func (s *Server) returnCommitments(ctx context.Context, uid string) ([]analytics.ReturnCommitment, error) {
	rows, err := s.deps.Store.ListCooldownSessions(ctx, uid)
	if err != nil {
		return nil, err
	}
	var out []analytics.ReturnCommitment
	for _, r := range rows {
		if !r.ReleasedAt.Valid || r.ReturnRule == "" || r.ReturnRule == cooldown.RuleNone {
			continue
		}
		out = append(out, analytics.ReturnCommitment{At: r.ReleasedAt.Time, Rule: r.ReturnRule})
	}
	return out, nil
}
