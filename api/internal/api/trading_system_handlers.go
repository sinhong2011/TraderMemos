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
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/system"
)

func (s *Server) tradingSystemRoutes(g *echo.Group) {
	g.GET("/system", s.handleGetTradingSystem)
	g.POST("/system/versions", s.handleStartSystemVersion)
	g.GET("/system/versions/:id", s.handleGetSystemVersion)
	g.PUT("/system/versions/:id", s.handleSaveSystemVersion)
	g.DELETE("/system/versions/:id", s.handleDiscardSystemDraft)
	g.POST("/system/versions/:id/activate", s.handleActivateSystemVersion)
	g.GET("/system/changes", s.handleListSystemChanges)
	g.GET("/system/regimes/:day", s.handleGetMarketRegime)
	g.PUT("/system/regimes/:day", s.handlePutMarketRegime)
	g.GET("/trades/:id/system-card", s.handleGetTradeSystemCard)
	g.PUT("/trades/:id/system-card", s.handlePutTradeSystemCard)
	g.GET("/analytics/system-review", s.handleSystemReview)
}

// --- DTOs ---

type ruleDTO struct {
	Text       string `json:"text"`
	Executable bool   `json:"executable"`
}

type versionDTO struct {
	ID            string              `json:"id"`
	Label         string              `json:"label"`
	Status        string              `json:"status"`
	Rules         map[string]ruleDTO  `json:"rules"`
	OpenQuestions map[string]string   `json:"open_questions"`
	Regimes       map[string]string   `json:"regimes"`
	TradeTypes    map[string]string   `json:"trade_types"`
	ActivatedAt   *time.Time          `json:"activated_at"`
	RetiredAt     *time.Time          `json:"retired_at"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
}

type tradingSystemDTO struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Active  *versionDTO  `json:"active"`
	Draft   *versionDTO  `json:"draft"`
	History []versionDTO `json:"history"`
	Plan    []system.Step `json:"plan"`
}

type changeDTO struct {
	ID               string    `json:"id"`
	VersionID        string    `json:"version_id"`
	Decision         string    `json:"decision"`
	Reason           string    `json:"reason"`
	Note             string    `json:"note"`
	EvidenceTradeIDs []string  `json:"evidence_trade_ids"`
	CreatedAt        time.Time `json:"created_at"`
}

type regimeDTO struct {
	Day    string `json:"day"`
	Regime string `json:"regime"`
	Note   string `json:"note"`
}

type systemCardDTO struct {
	TradeID         string          `json:"trade_id"`
	VersionID       *string         `json:"version_id"`
	VersionLabel    string          `json:"version_label"`
	Regime          string          `json:"regime"`
	DayRegime       string          `json:"day_regime"`
	TriggerMet      string          `json:"trigger_met"`
	TradeType       string          `json:"trade_type"`
	Thesis          string          `json:"thesis"`
	PlannedHoldDays *int64          `json:"planned_hold_days"`
	TimeStopDays    *int64          `json:"time_stop_days"`
	ExitState       string          `json:"exit_state"`
	Adherence       string          `json:"adherence"`
	SuggestedAdherence string       `json:"suggested_adherence"`
	Checklist       map[string]bool `json:"checklist"`
	Lesson          string          `json:"lesson"`
	RuleChange      bool            `json:"rule_change"`
	PlannedAt       *time.Time      `json:"planned_at"`
}

type systemReviewDTO struct {
	system.Review
	// MissedHesitated is counted in the date/account range only. It is NOT
	// folded into adherence_rate — misses have no system_version_id yet.
	MissedHesitated int      `json:"missed_hesitated"`
	AdherenceRate   *float64 `json:"adherence_rate"`
}

// --- JSON helpers ---

func encodeJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func decodeRules(raw string) map[string]ruleDTO {
	out := map[string]ruleDTO{}
	_ = json.Unmarshal([]byte(raw), &out)
	if out == nil {
		out = map[string]ruleDTO{}
	}
	for _, d := range system.Decisions {
		if _, ok := out[d]; !ok {
			out[d] = ruleDTO{}
		}
	}
	return out
}

func decodeStringMap(raw string) map[string]string {
	out := map[string]string{}
	_ = json.Unmarshal([]byte(raw), &out)
	if out == nil {
		out = map[string]string{}
	}
	return out
}

func decodeChecklist(raw string) map[string]bool {
	out := map[string]bool{}
	_ = json.Unmarshal([]byte(raw), &out)
	if out == nil {
		out = map[string]bool{}
	}
	return out
}

func nullTimePtr(v sql.NullTime) *time.Time {
	if !v.Valid {
		return nil
	}
	t := v.Time.UTC()
	return &t
}

func nullInt64Ptr(v sql.NullInt64) *int64 {
	if !v.Valid {
		return nil
	}
	return &v.Int64
}

func int64Null(v *int64) sql.NullInt64 {
	if v == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *v, Valid: true}
}

func versionFromRow(v store.SystemVersion) versionDTO {
	return versionDTO{
		ID: v.ID, Label: v.Label, Status: v.Status,
		Rules: decodeRules(v.Rules), OpenQuestions: decodeStringMap(v.OpenQuestions),
		Regimes: decodeStringMap(v.Regimes), TradeTypes: decodeStringMap(v.TradeTypes),
		ActivatedAt: nullTimePtr(v.ActivatedAt), RetiredAt: nullTimePtr(v.RetiredAt),
		CreatedAt: v.CreatedAt.UTC(), UpdatedAt: v.UpdatedAt.UTC(),
	}
}

func rulesToDomain(rules map[string]ruleDTO) map[string]system.Rule {
	out := make(map[string]system.Rule, len(rules))
	for k, r := range rules {
		out[k] = system.Rule{Text: r.Text, Executable: r.Executable}
	}
	return out
}

// --- system overview ---

func (s *Server) ensureTradingSystem(ctx context.Context, uid string) (store.TradingSystem, error) {
	row, err := s.deps.Store.GetTradingSystemByUser(ctx, uid)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return store.TradingSystem{}, err
	}
	return s.deps.Store.CreateTradingSystem(ctx, store.CreateTradingSystemParams{
		ID: uuid.New().String(), UserID: uid, Name: "My system",
	})
}

func (s *Server) handleGetTradingSystem(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	sys, err := s.ensureTradingSystem(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the system", nil)
	}
	versions, err := s.deps.Store.ListSystemVersions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load versions", nil)
	}
	var active, draft *versionDTO
	history := make([]versionDTO, 0)
	for _, v := range versions {
		dto := versionFromRow(v)
		switch v.Status {
		case "active":
			cp := dto
			active = &cp
		case "draft":
			cp := dto
			draft = &cp
		default:
			history = append(history, dto)
		}
	}
	plan, err := s.systemPlan(ctx, uid, versions)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not score the plan", nil)
	}
	return c.JSON(http.StatusOK, tradingSystemDTO{
		ID: sys.ID, Name: sys.Name, Active: active, Draft: draft, History: history, Plan: plan,
	})
}

func (s *Server) systemPlan(ctx context.Context, uid string, versions []store.SystemVersion) ([]system.Step, error) {
	in := system.PlanInput{}
	var firstActive *time.Time
	for _, v := range versions {
		if v.ActivatedAt.Valid {
			in.Activated++
			if firstActive == nil || v.ActivatedAt.Time.Before(*firstActive) {
				t := v.ActivatedAt.Time
				firstActive = &t
			}
		}
	}
	var rules map[string]ruleDTO
	for _, v := range versions {
		if v.Status == "active" {
			rules = decodeRules(v.Rules)
			break
		}
	}
	if rules == nil {
		for _, v := range versions {
			if v.Status == "draft" {
				rules = decodeRules(v.Rules)
				break
			}
		}
	}
	if rules != nil {
		in.Executable = system.ExecutableCount(rulesToDomain(rules))
	}

	cards, err := s.deps.Store.ListTradeSystemCards(ctx, uid)
	if err != nil {
		return nil, err
	}
	trades, err := s.deps.Store.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: uid})
	if err != nil {
		return nil, err
	}
	tradeByID := make(map[string]store.Trade, len(trades))
	for _, t := range trades {
		tradeByID[t.ID] = t
	}
	accounts, err := s.deps.Store.ListAccounts(ctx, uid)
	if err != nil {
		return nil, err
	}
	backtest := map[string]bool{}
	for _, a := range accounts {
		if a.AccountType == AccountTypeBacktest {
			backtest[a.ID] = true
		}
	}
	for _, cd := range cards {
		t, ok := tradeByID[cd.TradeID]
		if !ok || !t.ClosedAt.Valid {
			continue
		}
		if backtest[t.AccountID] || (firstActive != nil && t.OpenedAt.Before(*firstActive)) {
			in.HistoryTrades++
			continue
		}
		if firstActive != nil && !t.OpenedAt.Before(*firstActive) && !backtest[t.AccountID] {
			in.LiveTrades++
		}
	}
	return system.Plan(in), nil
}

// --- versions ---

type versionBody struct {
	Label         string             `json:"label"`
	Rules         map[string]ruleDTO `json:"rules"`
	OpenQuestions map[string]string  `json:"open_questions"`
	Regimes       map[string]string  `json:"regimes"`
	TradeTypes    map[string]string  `json:"trade_types"`
}

func (s *Server) handleStartSystemVersion(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	sys, err := s.ensureTradingSystem(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the system", nil)
	}
	if _, err := s.deps.Store.GetDraftSystemVersion(ctx, uid); err == nil {
		return Fail(http.StatusConflict, "conflict", "a draft already exists", nil)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not check drafts", nil)
	}
	label := "v1.0"
	rules := map[string]ruleDTO{}
	for _, d := range system.Decisions {
		rules[d] = ruleDTO{}
	}
	openQ := map[string]string{}
	regimes := system.DefaultRegimes()
	types := system.DefaultTradeTypes()
	if active, err := s.deps.Store.GetActiveSystemVersion(ctx, uid); err == nil {
		src := versionFromRow(active)
		rules, openQ, regimes, types = src.Rules, src.OpenQuestions, src.Regimes, src.TradeTypes
		label = nextLabel(src.Label)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load the active version", nil)
	}
	row, err := s.deps.Store.CreateSystemVersion(ctx, store.CreateSystemVersionParams{
		ID: uuid.New().String(), SystemID: sys.ID, UserID: uid, Label: label, Status: "draft",
		Rules: encodeJSON(rules), OpenQuestions: encodeJSON(openQ),
		Regimes: encodeJSON(regimes), TradeTypes: encodeJSON(types),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not start the version", nil)
	}
	return c.JSON(http.StatusCreated, versionFromRow(row))
}

func nextLabel(prev string) string {
	prev = strings.TrimSpace(prev)
	if prev == "" {
		return "v1.1"
	}
	// Simple bump: v1.0 → v1.1, v1.9 → v1.10, anything else → prev+".1"
	if strings.HasPrefix(prev, "v") {
		rest := prev[1:]
		parts := strings.SplitN(rest, ".", 2)
		if len(parts) == 2 {
			var major, minor int
			if _, err := parseInt(parts[0], &major); err == nil {
				if _, err := parseInt(parts[1], &minor); err == nil {
					return "v" + itoa(major) + "." + itoa(minor+1)
				}
			}
		}
	}
	return prev + ".1"
}

func parseInt(s string, out *int) (int, error) {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, errors.New("not an int")
		}
		n = n*10 + int(r-'0')
	}
	*out = n
	return n, nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

func (s *Server) handleGetSystemVersion(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	row, err := s.deps.Store.GetSystemVersion(ctx, store.GetSystemVersionParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "version not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the version", nil)
	}
	return c.JSON(http.StatusOK, versionFromRow(row))
}

func (s *Server) handleSaveSystemVersion(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in versionBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.Rules == nil {
		in.Rules = map[string]ruleDTO{}
	}
	for _, d := range system.Decisions {
		if _, ok := in.Rules[d]; !ok {
			in.Rules[d] = ruleDTO{}
		}
	}
	if in.Regimes == nil {
		in.Regimes = system.DefaultRegimes()
	}
	if in.TradeTypes == nil {
		in.TradeTypes = system.DefaultTradeTypes()
	}
	if in.OpenQuestions == nil {
		in.OpenQuestions = map[string]string{}
	}
	label := strings.TrimSpace(in.Label)
	if label == "" {
		return Fail(http.StatusBadRequest, "bad_request", "label is required", nil)
	}
	row, err := s.deps.Store.UpdateSystemVersion(ctx, store.UpdateSystemVersionParams{
		Label: label, Rules: encodeJSON(in.Rules), OpenQuestions: encodeJSON(in.OpenQuestions),
		Regimes: encodeJSON(in.Regimes), TradeTypes: encodeJSON(in.TradeTypes),
		ID: c.Param("id"), UserID: uid,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "draft not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save the draft", nil)
	}
	return c.JSON(http.StatusOK, versionFromRow(row))
}

func (s *Server) handleDiscardSystemDraft(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	n, err := s.deps.Store.DeleteSystemVersion(ctx, store.DeleteSystemVersionParams{ID: c.Param("id"), UserID: uid})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not discard the draft", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "draft not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

type activateBody struct {
	Changes []struct {
		Decision         string   `json:"decision"`
		Reason           string   `json:"reason"`
		Note             string   `json:"note"`
		EvidenceTradeIDs []string `json:"evidence_trade_ids"`
	} `json:"changes"`
}

func (s *Server) handleActivateSystemVersion(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	draft, err := s.deps.Store.GetSystemVersion(ctx, store.GetSystemVersionParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "version not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the version", nil)
	}
	if draft.Status != "draft" {
		return Fail(http.StatusBadRequest, "bad_request", "only a draft can be activated", nil)
	}
	var in activateBody
	_ = c.Bind(&in)

	var prev *store.SystemVersion
	if active, err := s.deps.Store.GetActiveSystemVersion(ctx, uid); err == nil {
		prev = &active
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load the active version", nil)
	}

	changed := map[string]bool{}
	if prev != nil {
		a, b := decodeRules(prev.Rules), decodeRules(draft.Rules)
		for _, d := range system.Decisions {
			if a[d].Text != b[d].Text || a[d].Executable != b[d].Executable {
				changed[d] = true
			}
		}
	}
	provided := map[string]bool{}
	for _, ch := range in.Changes {
		if !changed[ch.Decision] && prev != nil {
			continue
		}
		if !slices.Contains(system.ChangeReasons, ch.Reason) {
			return Fail(http.StatusBadRequest, "bad_request", "invalid change reason", nil)
		}
		if !slices.Contains(system.Decisions, ch.Decision) {
			return Fail(http.StatusBadRequest, "bad_request", "unknown decision", nil)
		}
		provided[ch.Decision] = true
	}
	if prev != nil {
		for d := range changed {
			if !provided[d] {
				return Fail(http.StatusBadRequest, "bad_request", "reason required for each changed decision", map[string]any{"decision": d})
			}
		}
	}

	now := time.Now().UTC()
	if prev != nil {
		if _, err := s.deps.Store.RetireSystemVersion(ctx, store.RetireSystemVersionParams{
			RetiredAt: sql.NullTime{Time: now, Valid: true}, ID: prev.ID, UserID: uid,
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not retire the previous version", nil)
		}
	}
	row, err := s.deps.Store.ActivateSystemVersion(ctx, store.ActivateSystemVersionParams{
		ActivatedAt: sql.NullTime{Time: now, Valid: true}, ID: draft.ID, UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not activate", nil)
	}
	for _, ch := range in.Changes {
		if prev != nil && !changed[ch.Decision] {
			continue
		}
		ids := ch.EvidenceTradeIDs
		if ids == nil {
			ids = []string{}
		}
		if _, err := s.deps.Store.CreateSystemChange(ctx, store.CreateSystemChangeParams{
			ID: uuid.New().String(), VersionID: row.ID, UserID: uid, Decision: ch.Decision,
			Reason: ch.Reason, Note: strings.TrimSpace(ch.Note), EvidenceTradeIds: encodeJSON(ids),
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not write the change log", nil)
		}
	}
	return c.JSON(http.StatusOK, versionFromRow(row))
}

func (s *Server) handleListSystemChanges(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	rows, err := s.deps.Store.ListSystemChanges(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load changes", nil)
	}
	out := make([]changeDTO, 0, len(rows))
	for _, r := range rows {
		ids := []string{}
		_ = json.Unmarshal([]byte(r.EvidenceTradeIds), &ids)
		out = append(out, changeDTO{
			ID: r.ID, VersionID: r.VersionID, Decision: r.Decision, Reason: r.Reason,
			Note: r.Note, EvidenceTradeIDs: ids, CreatedAt: r.CreatedAt.UTC(),
		})
	}
	return c.JSON(http.StatusOK, out)
}

// --- regimes ---

func (s *Server) handleGetMarketRegime(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	day := c.Param("day")
	if !validDay(day) {
		return Fail(http.StatusBadRequest, "bad_request", "day must be YYYY-MM-DD", nil)
	}
	row, err := s.deps.Store.GetMarketRegimeDay(ctx, store.GetMarketRegimeDayParams{UserID: uid, Day: day})
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, regimeDTO{Day: day})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the regime", nil)
	}
	return c.JSON(http.StatusOK, regimeDTO{Day: row.Day, Regime: row.Regime, Note: row.Note})
}

func (s *Server) handlePutMarketRegime(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	day := c.Param("day")
	if !validDay(day) {
		return Fail(http.StatusBadRequest, "bad_request", "day must be YYYY-MM-DD", nil)
	}
	var in struct {
		Regime string `json:"regime"`
		Note   string `json:"note"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	in.Regime = strings.TrimSpace(in.Regime)
	if in.Regime == "" {
		if _, err := s.deps.Store.DeleteMarketRegimeDay(ctx, store.DeleteMarketRegimeDayParams{UserID: uid, Day: day}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not clear the regime", nil)
		}
		return c.JSON(http.StatusOK, regimeDTO{Day: day})
	}
	if !system.ValidStance(in.Regime) {
		// Allow custom keys that match active version regimes.
		if active, err := s.deps.Store.GetActiveSystemVersion(ctx, uid); err == nil {
			if _, ok := decodeStringMap(active.Regimes)[in.Regime]; !ok {
				return Fail(http.StatusBadRequest, "bad_request", "unknown regime", nil)
			}
		} else {
			return Fail(http.StatusBadRequest, "bad_request", "unknown regime", nil)
		}
	}
	row, err := s.deps.Store.UpsertMarketRegimeDay(ctx, store.UpsertMarketRegimeDayParams{
		UserID: uid, Day: day, Regime: in.Regime, Note: strings.TrimSpace(in.Note),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save the regime", nil)
	}
	return c.JSON(http.StatusOK, regimeDTO{Day: row.Day, Regime: row.Regime, Note: row.Note})
}

func validDay(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// --- trade system card ---

type systemCardInput struct {
	VersionID       *string         `json:"version_id"`
	Regime          string          `json:"regime"`
	TriggerMet      string          `json:"trigger_met"`
	TradeType       string          `json:"trade_type"`
	Thesis          string          `json:"thesis"`
	PlannedHoldDays *int64          `json:"planned_hold_days"`
	TimeStopDays    *int64          `json:"time_stop_days"`
	ExitState       string          `json:"exit_state"`
	Adherence       string          `json:"adherence"`
	Checklist       map[string]bool `json:"checklist"`
	Lesson          string          `json:"lesson"`
	RuleChange      bool            `json:"rule_change"`
	PlannedAt       *time.Time      `json:"planned_at"`
}

func (in systemCardInput) hasPlan() bool {
	return strings.TrimSpace(in.Thesis) != "" || in.PlannedHoldDays != nil ||
		in.TriggerMet != "" || in.TradeType != "" || in.Regime != ""
}

func (s *Server) handleGetTradeSystemCard(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	trade, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the trade", nil)
	}
	versions, err := s.deps.Store.ListSystemVersions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load versions", nil)
	}
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	day := trade.OpenedAt.In(loc).Format("2006-01-02")
	dayRegime := ""
	if r, err := s.deps.Store.GetMarketRegimeDay(ctx, store.GetMarketRegimeDayParams{UserID: uid, Day: day}); err == nil {
		dayRegime = r.Regime
	}
	card, err := s.deps.Store.GetTradeSystemCard(ctx, store.GetTradeSystemCardParams{TradeID: trade.ID, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, emptyCard(trade.ID, versions, trade.OpenedAt, dayRegime))
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the card", nil)
	}
	return c.JSON(http.StatusOK, systemCardFromRow(trade, &card, versions, day, dayRegime))
}

func emptyCard(tradeID string, versions []store.SystemVersion, opened time.Time, dayRegime string) systemCardDTO {
	dto := systemCardDTO{TradeID: tradeID, DayRegime: dayRegime, Checklist: map[string]bool{}}
	if v := versionAt(versions, opened); v != nil {
		dto.VersionID = &v.ID
		dto.VersionLabel = v.Label
	}
	return dto
}

func versionAt(versions []store.SystemVersion, t time.Time) *store.SystemVersion {
	var best *store.SystemVersion
	for i := range versions {
		v := &versions[i]
		if !v.ActivatedAt.Valid || v.ActivatedAt.Time.After(t) {
			continue
		}
		if best == nil || v.ActivatedAt.Time.After(best.ActivatedAt.Time) {
			best = v
		}
	}
	return best
}

func systemCardFromRow(t store.Trade, row *store.TradeSystemCard, versions []store.SystemVersion, day, dayRegime string) systemCardDTO {
	_ = day
	checks := decodeChecklist(row.Checklist)
	dto := systemCardDTO{
		TradeID: t.ID, Regime: row.Regime, DayRegime: dayRegime, TriggerMet: row.TriggerMet,
		TradeType: row.TradeType, Thesis: row.Thesis, PlannedHoldDays: nullInt64Ptr(row.PlannedHoldDays),
		TimeStopDays: nullInt64Ptr(row.TimeStopDays), ExitState: row.ExitState, Adherence: row.Adherence,
		SuggestedAdherence: system.SuggestAdherence(checks), Checklist: checks, Lesson: row.Lesson,
		RuleChange: row.RuleChange != 0, PlannedAt: nullTimePtr(row.PlannedAt),
	}
	if row.VersionID.Valid {
		id := row.VersionID.String
		dto.VersionID = &id
		for _, v := range versions {
			if v.ID == id {
				dto.VersionLabel = v.Label
				break
			}
		}
	}
	return dto
}

func (s *Server) handlePutTradeSystemCard(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	trade, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the trade", nil)
	}
	var in systemCardInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.Checklist == nil {
		in.Checklist = map[string]bool{}
	}
	if in.Adherence != "" && !slices.Contains(system.Adherences, in.Adherence) {
		return Fail(http.StatusBadRequest, "bad_request", "invalid adherence", nil)
	}
	if in.ExitState != "" && !slices.Contains(system.ExitStates, in.ExitState) {
		return Fail(http.StatusBadRequest, "bad_request", "invalid exit_state", nil)
	}
	if in.TriggerMet != "" && !slices.Contains(system.Triggers, in.TriggerMet) {
		return Fail(http.StatusBadRequest, "bad_request", "invalid trigger_met", nil)
	}
	if in.Adherence == "" {
		in.Adherence = system.SuggestAdherence(in.Checklist)
	}
	versions, err := s.deps.Store.ListSystemVersions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load versions", nil)
	}
	vid := sql.NullString{}
	if in.VersionID != nil && *in.VersionID != "" {
		vid = sql.NullString{String: *in.VersionID, Valid: true}
	} else if v := versionAt(versions, trade.OpenedAt); v != nil {
		vid = sql.NullString{String: v.ID, Valid: true}
	}
	var planned sql.NullTime
	if in.PlannedAt != nil {
		planned = sql.NullTime{Time: in.PlannedAt.UTC(), Valid: true}
	} else if in.hasPlan() {
		// First save of plan fields stamps planned_at now (plan-before-entry when before open).
		planned = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	var ruleChange int64
	if in.RuleChange {
		ruleChange = 1
	}
	row, err := s.deps.Store.UpsertTradeSystemCard(ctx, store.UpsertTradeSystemCardParams{
		TradeID: trade.ID, UserID: uid, VersionID: vid, Regime: strings.TrimSpace(in.Regime),
		TriggerMet: in.TriggerMet, TradeType: strings.TrimSpace(in.TradeType), Thesis: strings.TrimSpace(in.Thesis),
		PlannedHoldDays: int64Null(in.PlannedHoldDays), TimeStopDays: int64Null(in.TimeStopDays),
		ExitState: in.ExitState, Adherence: in.Adherence, Checklist: encodeJSON(in.Checklist),
		Lesson: strings.TrimSpace(in.Lesson), RuleChange: ruleChange, PlannedAt: planned,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save the card", nil)
	}
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	day := trade.OpenedAt.In(loc).Format("2006-01-02")
	dayRegime := ""
	if r, err := s.deps.Store.GetMarketRegimeDay(ctx, store.GetMarketRegimeDayParams{UserID: uid, Day: day}); err == nil {
		dayRegime = r.Regime
	}
	return c.JSON(http.StatusOK, systemCardFromRow(trade, &row, versions, day, dayRegime))
}

// --- review (Phase A: hesitated separate; mixed currency via loadClosedTrades) ---

func (s *Server) handleSystemReview(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not load trades")
	}
	cardRows, err := s.deps.Store.ListTradeSystemCards(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cards", nil)
	}
	cards := make(map[string]store.TradeSystemCard, len(cardRows))
	for _, cd := range cardRows {
		cards[cd.TradeID] = cd
	}
	versions, err := s.deps.Store.ListSystemVersions(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the system", nil)
	}
	regimeRows, err := s.deps.Store.ListAllMarketRegimeDays(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load regimes", nil)
	}
	dayRegime := make(map[string]string, len(regimeRows))
	for _, r := range regimeRows {
		dayRegime[r.Day] = r.Regime
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load journals", nil)
	}
	type plan struct {
		risk  float64
		setup string
	}
	plans := make(map[string]plan, len(journals))
	for _, j := range journals {
		plans[j.TradeID] = plan{risk: j.InitialRisk.Float64, setup: j.SetupID.String}
	}
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	versionFilter := c.QueryParam("version_id")

	trades := make([]system.Trade, 0, len(rows))
	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		rt := system.Trade{
			ID: t.ID, OpenedAt: t.OpenedAt, ClosedAt: t.ClosedAt.Time, NetPnl: t.NetPnl.Float64,
			HoldSecs: t.TimeInTradeSecs.Int64, SetupID: plans[t.ID].setup,
		}
		if p := plans[t.ID]; p.risk > 0 {
			r := t.NetPnl.Float64 / p.risk
			rt.R = &r
		}
		card, carded := cards[t.ID]
		if carded {
			rt.Carded = true
			rt.Regime = card.Regime
			rt.Adherence = card.Adherence
			rt.ExitState = card.ExitState
			rt.TradeType = card.TradeType
			rt.Trigger = card.TriggerMet
			rt.VersionID = card.VersionID.String
			if card.PlannedAt.Valid {
				ahead := !card.PlannedAt.Time.After(t.OpenedAt)
				rt.PlannedAhead = &ahead
			}
		} else if v := versionAt(versions, t.OpenedAt); v != nil {
			rt.VersionID = v.ID
		}
		if rt.Regime == "" {
			rt.Regime = dayRegime[t.OpenedAt.In(loc).Format("2006-01-02")]
		}
		if versionFilter != "" && rt.VersionID != versionFilter {
			continue
		}
		trades = append(trades, rt)
	}
	out := systemReviewDTO{Review: system.Compute(trades)}

	// Hesitated misses: shown separately; never in adherence_rate denominator.
	misses, err := s.deps.Store.ListMissedTrades(ctx, uid)
	if err == nil {
		for _, m := range missedInRange(misses, f) {
			if m.Reason == "hesitated" {
				out.MissedHesitated++
			}
		}
	}
	if den := out.Coverage.Adherence; den > 0 {
		full := out.Quadrant.RightWin.Trades + out.Quadrant.RightLoss.Trades
		rate := float64(full) / float64(den)
		out.AdherenceRate = &rate
	}
	return c.JSON(http.StatusOK, out)
}
