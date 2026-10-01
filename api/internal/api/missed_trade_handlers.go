package api

import (
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

// Missed trades are setups seen and not taken. They live in their own table and
// never enter trade stats; the summary prices what they would have made.
func (s *Server) missedTradeRoutes(g *echo.Group) {
	g.GET("/missed-trades", s.handleListMissedTrades)
	g.POST("/missed-trades", s.handleCreateMissedTrade)
	g.GET("/missed-trades/summary", s.handleMissedTradeSummary)
	g.PUT("/missed-trades/:id", s.handleUpdateMissedTrade)
	g.DELETE("/missed-trades/:id", s.handleDeleteMissedTrade)
}

var (
	missedOutcomes = []string{
		analytics.MissedUnknown, analytics.MissedTarget, analytics.MissedStop, analytics.MissedNoTrigger,
	}
	missedReasons = []string{
		"", analytics.MissedHesitated, analytics.MissedAway, analytics.MissedRules, analytics.MissedOther,
	}
)

type missedTradeDTO struct {
	ID         string    `json:"id"`
	AccountID  *string   `json:"account_id"`
	SetupID    *string   `json:"setup_id"`
	Symbol     string    `json:"symbol"`
	Direction  string    `json:"direction"`
	ObservedAt time.Time `json:"observed_at"`
	Entry      *float64  `json:"entry"`
	Stop       *float64  `json:"stop"`
	Target     *float64  `json:"target"`
	Reason     string    `json:"reason"`
	Outcome    string    `json:"outcome"`
	Notes      string    `json:"notes"`
	PlannedR   *float64  `json:"planned_r"`
	// R is what the miss would have made given its outcome; nil when unknown.
	R         *float64  `json:"r"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func nullStrPtr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}

func nullFloatPtr(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	return &v.Float64
}

func floatPtrNull(v *float64) sql.NullFloat64 {
	if v == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *v, Valid: true}
}

func strPtrNull(v *string) sql.NullString {
	if v == nil || *v == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}

func missedPlan(m store.MissedTrade) analytics.MissedPlan {
	return analytics.MissedPlan{
		Direction: m.Direction, Entry: nullFloatPtr(m.Entry), Stop: nullFloatPtr(m.Stop), Target: nullFloatPtr(m.Target),
	}
}

func missedTradeFromRow(m store.MissedTrade) missedTradeDTO {
	planned := missedPlan(m).PlannedR()
	return missedTradeDTO{
		ID: m.ID, AccountID: nullStrPtr(m.AccountID), SetupID: nullStrPtr(m.SetupID),
		Symbol: m.Symbol, Direction: m.Direction, ObservedAt: m.ObservedAt,
		Entry: nullFloatPtr(m.Entry), Stop: nullFloatPtr(m.Stop), Target: nullFloatPtr(m.Target),
		Reason: m.Reason, Outcome: m.Outcome, Notes: m.Notes,
		PlannedR: planned, R: analytics.MissedR(m.Outcome, planned),
		CreatedAt: m.CreatedAt, UpdatedAt: m.UpdatedAt,
	}
}

type missedTradeInput struct {
	AccountID  *string    `json:"account_id"`
	SetupID    *string    `json:"setup_id"`
	Symbol     string     `json:"symbol"`
	Direction  string     `json:"direction"`
	ObservedAt *time.Time `json:"observed_at"`
	Entry      *float64   `json:"entry"`
	Stop       *float64   `json:"stop"`
	Target     *float64   `json:"target"`
	Reason     string     `json:"reason"`
	Outcome    string     `json:"outcome"`
	Notes      string     `json:"notes"`
}

// validate normalizes and checks a missed trade, including that a full price
// plan is coherent for its direction (the same rule PlannedR prices by).
func (s *Server) validateMissedTrade(c *echo.Context, uid string, in *missedTradeInput) error {
	ctx := c.Request().Context()
	in.Symbol = strings.ToUpper(strings.TrimSpace(in.Symbol))
	if in.Symbol == "" {
		return errors.New("symbol is required")
	}
	if in.Direction != "long" && in.Direction != "short" {
		return errors.New("direction must be long or short")
	}
	if in.ObservedAt == nil || in.ObservedAt.IsZero() {
		return errors.New("observed_at is required")
	}
	if in.Outcome == "" {
		in.Outcome = analytics.MissedUnknown
	}
	if !slices.Contains(missedOutcomes, in.Outcome) {
		return errors.New("outcome must be unknown, target, stop or no_trigger")
	}
	if !slices.Contains(missedReasons, in.Reason) {
		return errors.New("reason must be hesitated, away, rules, other or empty")
	}
	for _, p := range []*float64{in.Entry, in.Stop, in.Target} {
		if p != nil && *p <= 0 {
			return errors.New("prices must be positive")
		}
	}
	if in.Entry != nil && in.Stop != nil && in.Target != nil {
		plan := analytics.MissedPlan{Direction: in.Direction, Entry: in.Entry, Stop: in.Stop, Target: in.Target}
		if plan.PlannedR() == nil {
			if in.Direction == "long" {
				return errors.New("a long needs stop below entry and target above it")
			}
			return errors.New("a short needs stop above entry and target below it")
		}
	}
	if in.AccountID != nil && *in.AccountID != "" {
		if err := s.assertAccount(ctx, uid, *in.AccountID); err != nil {
			return errors.New("account not found")
		}
	}
	if in.SetupID != nil && *in.SetupID != "" {
		if _, err := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: *in.SetupID, UserID: uid}); err != nil {
			return errors.New("setup not found")
		}
	}
	return nil
}

// missedInRange applies the shared account/date filters in Go; the table is
// small and per-user, so a single unfiltered query keeps both engines simple.
func missedInRange(rows []store.MissedTrade, f Filters) []store.MissedTrade {
	out := []store.MissedTrade{}
	for _, m := range rows {
		if len(f.AccountIDs) > 0 && (!m.AccountID.Valid || !f.matchAccount(m.AccountID.String)) {
			continue
		}
		if f.From != nil && m.ObservedAt.Before(*f.From) {
			continue
		}
		if f.To != nil && m.ObservedAt.After(*f.To) {
			continue
		}
		out = append(out, m)
	}
	return out
}

func (s *Server) loadMissedTrades(c *echo.Context) ([]store.MissedTrade, error) {
	f, err := parseFilters(c)
	if err != nil {
		return nil, Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.deps.Store.ListMissedTrades(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return nil, Fail(http.StatusInternalServerError, "internal", "could not load missed trades", nil)
	}
	return missedInRange(rows, f), nil
}

func (s *Server) handleListMissedTrades(c *echo.Context) error {
	rows, err := s.loadMissedTrades(c)
	if err != nil {
		return err
	}
	out := make([]missedTradeDTO, 0, len(rows))
	for _, m := range rows {
		out = append(out, missedTradeFromRow(m))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleMissedTradeSummary(c *echo.Context) error {
	rows, err := s.loadMissedTrades(c)
	if err != nil {
		return err
	}
	ms := make([]analytics.MissedTrade, 0, len(rows))
	for _, m := range rows {
		ms = append(ms, analytics.MissedTrade{
			Reason: m.Reason, SetupID: m.SetupID.String, Outcome: m.Outcome, PlannedR: missedPlan(m).PlannedR(),
		})
	}
	return c.JSON(http.StatusOK, analytics.SummarizeMissed(ms))
}

func (s *Server) handleCreateMissedTrade(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in missedTradeInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := s.validateMissedTrade(c, uid, &in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	row, err := s.deps.Store.CreateMissedTrade(ctx, store.CreateMissedTradeParams{
		ID: uuid.New().String(), UserID: uid, AccountID: strPtrNull(in.AccountID), SetupID: strPtrNull(in.SetupID),
		Symbol: in.Symbol, Direction: in.Direction, ObservedAt: in.ObservedAt.UTC(),
		Entry: floatPtrNull(in.Entry), Stop: floatPtrNull(in.Stop), Target: floatPtrNull(in.Target),
		Reason: in.Reason, Outcome: in.Outcome, Notes: in.Notes,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save missed trade", nil)
	}
	return c.JSON(http.StatusCreated, missedTradeFromRow(row))
}

func (s *Server) handleUpdateMissedTrade(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in missedTradeInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := s.validateMissedTrade(c, uid, &in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	row, err := s.deps.Store.UpdateMissedTrade(ctx, store.UpdateMissedTradeParams{
		AccountID: strPtrNull(in.AccountID), SetupID: strPtrNull(in.SetupID),
		Symbol: in.Symbol, Direction: in.Direction, ObservedAt: in.ObservedAt.UTC(),
		Entry: floatPtrNull(in.Entry), Stop: floatPtrNull(in.Stop), Target: floatPtrNull(in.Target),
		Reason: in.Reason, Outcome: in.Outcome, Notes: in.Notes, ID: c.Param("id"), UserID: uid,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "missed trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save missed trade", nil)
	}
	return c.JSON(http.StatusOK, missedTradeFromRow(row))
}

func (s *Server) handleDeleteMissedTrade(c *echo.Context) error {
	n, err := s.deps.Store.DeleteMissedTrade(c.Request().Context(), store.DeleteMissedTradeParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete missed trade", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "missed trade not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
