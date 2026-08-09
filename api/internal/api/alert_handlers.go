package api

import (
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) alertRoutes(g *echo.Group) {
	g.GET("/settings/alerts", s.handleGetAlertSettings)
	g.PUT("/settings/alerts", s.handlePutAlertSettings)
	g.GET("/settings/alert-channels", s.handleListAlertChannels)
	g.POST("/settings/alert-channels", s.handleCreateAlertChannel)
	g.PATCH("/settings/alert-channels/:id", s.handlePatchAlertChannel)
	g.DELETE("/settings/alert-channels/:id", s.handleDeleteAlertChannel)
	g.POST("/settings/alert-channels/:id/test", s.handleTestAlertChannel)
	g.GET("/alerts/events", s.handleListAlertEvents)
	g.POST("/me/push-tokens", s.handleRegisterPushToken)
	g.DELETE("/me/push-tokens", s.handleUnregisterPushToken)
}

type alertSettingsDTO struct {
	Enabled          bool    `json:"enabled"`
	Timezone         string  `json:"timezone"`
	RuleRisk         bool    `json:"rule_risk"`
	RuleDailyLoss    bool    `json:"rule_daily_loss"`
	RuleLossStreak   bool    `json:"rule_loss_streak"`
	LossStreakN      int     `json:"loss_streak_n"`
	RulePropDrawdown bool    `json:"rule_prop_drawdown"`
	PropWarnPct      float64 `json:"prop_warn_pct"`
	RuleUnreviewed   bool    `json:"rule_unreviewed"`
	UnreviewedDays   int     `json:"unreviewed_days"`
}

func defaultAlertSettingsDTO() alertSettingsDTO {
	return alertSettingsDTO{
		RuleRisk: true, RuleDailyLoss: true, RuleLossStreak: true, LossStreakN: 3,
		RulePropDrawdown: true, PropWarnPct: 0.8, RuleUnreviewed: true, UnreviewedDays: 7,
	}
}

func toAlertSettingsDTO(r store.AlertSetting) alertSettingsDTO {
	return alertSettingsDTO{
		Enabled:          r.Enabled != 0,
		Timezone:         r.Timezone,
		RuleRisk:         r.RuleRisk != 0,
		RuleDailyLoss:    r.RuleDailyLoss != 0,
		RuleLossStreak:   r.RuleLossStreak != 0,
		LossStreakN:      int(r.LossStreakN),
		RulePropDrawdown: r.RulePropDrawdown != 0,
		PropWarnPct:      r.PropWarnPct,
		RuleUnreviewed:   r.RuleUnreviewed != 0,
		UnreviewedDays:   int(r.UnreviewedDays),
	}
}

func (s *Server) handleGetAlertSettings(c *echo.Context) error {
	uid := auth.UserID(c)
	r, err := s.deps.Store.GetAlertSettings(c.Request().Context(), uid)
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, defaultAlertSettingsDTO())
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load alert settings", nil)
	}
	return c.JSON(http.StatusOK, toAlertSettingsDTO(r))
}

func (s *Server) handlePutAlertSettings(c *echo.Context) error {
	uid := auth.UserID(c)
	in := defaultAlertSettingsDTO()
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.LossStreakN < 1 || in.LossStreakN > 50 {
		return Fail(http.StatusBadRequest, "bad_request", "loss_streak_n must be between 1 and 50", nil)
	}
	if in.PropWarnPct <= 0 || in.PropWarnPct >= 1 {
		return Fail(http.StatusBadRequest, "bad_request", "prop_warn_pct must be between 0 and 1 (exclusive)", nil)
	}
	if in.UnreviewedDays < 1 || in.UnreviewedDays > 90 {
		return Fail(http.StatusBadRequest, "bad_request", "unreviewed_days must be between 1 and 90", nil)
	}
	if in.Timezone != "" {
		if _, err := time.LoadLocation(in.Timezone); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "timezone must be an IANA timezone name", nil)
		}
	}
	r, err := s.deps.Store.UpsertAlertSettings(c.Request().Context(), store.UpsertAlertSettingsParams{
		UserID:           uid,
		Enabled:          b2i(in.Enabled),
		Timezone:         in.Timezone,
		RuleRisk:         b2i(in.RuleRisk),
		RuleDailyLoss:    b2i(in.RuleDailyLoss),
		RuleLossStreak:   b2i(in.RuleLossStreak),
		LossStreakN:      int64(in.LossStreakN),
		RulePropDrawdown: b2i(in.RulePropDrawdown),
		PropWarnPct:      in.PropWarnPct,
		RuleUnreviewed:   b2i(in.RuleUnreviewed),
		UnreviewedDays:   int64(in.UnreviewedDays),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save alert settings", nil)
	}
	return c.JSON(http.StatusOK, toAlertSettingsDTO(r))
}

func b2i(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

type alertChannelDTO struct {
	ID         string     `json:"id"`
	Kind       string     `json:"kind"`
	Target     string     `json:"target"`
	Label      string     `json:"label"`
	Enabled    bool       `json:"enabled"`
	LastSentAt *time.Time `json:"last_sent_at"`
	LastStatus string     `json:"last_status"`
	LastError  string     `json:"last_error"`
}

func toAlertChannelDTO(ch store.AlertChannel) alertChannelDTO {
	var sent *time.Time
	if ch.LastSentAt.Valid {
		t := ch.LastSentAt.Time
		sent = &t
	}
	return alertChannelDTO{
		ID: ch.ID, Kind: ch.Kind, Target: ch.Target, Label: ch.Label,
		Enabled: ch.Enabled != 0, LastSentAt: sent,
		LastStatus: ch.LastStatus, LastError: ch.LastError,
	}
}

func (s *Server) handleListAlertChannels(c *echo.Context) error {
	uid := auth.UserID(c)
	rows, err := s.deps.Store.ListAlertChannels(c.Request().Context(), uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load alert channels", nil)
	}
	out := make([]alertChannelDTO, 0, len(rows))
	for _, ch := range rows {
		out = append(out, toAlertChannelDTO(ch))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleCreateAlertChannel(c *echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		Kind   string `json:"kind"`
		Target string `json:"target"`
		Label  string `json:"label"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	// Expo channels register through POST /me/push-tokens; this endpoint only
	// creates webhooks the user typed in.
	if in.Kind != "webhook" {
		return Fail(http.StatusBadRequest, "bad_request", "kind must be webhook", nil)
	}
	u, err := url.Parse(strings.TrimSpace(in.Target))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return Fail(http.StatusBadRequest, "bad_request", "target must be an http(s) URL", nil)
	}
	ch, err := s.deps.Store.UpsertAlertChannel(c.Request().Context(), store.UpsertAlertChannelParams{
		ID: uuid.NewString(), UserID: uid, Kind: "webhook", Target: u.String(), Label: in.Label,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save alert channel", nil)
	}
	return c.JSON(http.StatusOK, toAlertChannelDTO(ch))
}

func (s *Server) handlePatchAlertChannel(c *echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		Enabled *bool `json:"enabled"`
	}
	if err := c.Bind(&in); err != nil || in.Enabled == nil {
		return Fail(http.StatusBadRequest, "bad_request", "enabled is required", nil)
	}
	ch, err := s.deps.Store.SetAlertChannelEnabled(c.Request().Context(), store.SetAlertChannelEnabledParams{
		Enabled: b2i(*in.Enabled), ID: c.Param("id"), UserID: uid,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "alert channel not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update alert channel", nil)
	}
	return c.JSON(http.StatusOK, toAlertChannelDTO(ch))
}

func (s *Server) handleDeleteAlertChannel(c *echo.Context) error {
	uid := auth.UserID(c)
	n, err := s.deps.Store.DeleteAlertChannel(c.Request().Context(), store.DeleteAlertChannelParams{
		ID: c.Param("id"), UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete alert channel", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "alert channel not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Server) handleTestAlertChannel(c *echo.Context) error {
	uid := auth.UserID(c)
	if s.deps.Alerts == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "alerts are not enabled on this server", nil)
	}
	ch, err := s.deps.Store.GetAlertChannel(c.Request().Context(), store.GetAlertChannelParams{
		ID: c.Param("id"), UserID: uid,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "alert channel not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load alert channel", nil)
	}
	if terr := s.deps.Alerts.SendTest(c.Request().Context(), ch); terr != nil {
		return c.JSON(http.StatusOK, map[string]any{"ok": false, "error": terr.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleListAlertEvents(c *echo.Context) error {
	uid := auth.UserID(c)
	limit := int64(50)
	if raw := c.QueryParam("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 200 {
			return Fail(http.StatusBadRequest, "bad_request", "limit must be between 1 and 200", nil)
		}
		limit = int64(n)
	}
	rows, err := s.deps.Store.ListAlertEvents(c.Request().Context(), store.ListAlertEventsParams{
		UserID: uid, Limit: limit,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load alert events", nil)
	}
	if rows == nil {
		rows = []store.AlertEvent{}
	}
	return c.JSON(http.StatusOK, rows)
}

// expoTokenValid loosely checks the ExponentPushToken[...] / ExpoPushToken[...]
// shapes so typos don't become permanently dead channels.
func expoTokenValid(t string) bool {
	return (strings.HasPrefix(t, "ExponentPushToken[") || strings.HasPrefix(t, "ExpoPushToken[")) &&
		strings.HasSuffix(t, "]") && len(t) < 256
}

func (s *Server) handleRegisterPushToken(c *echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		Token string `json:"token"`
		Label string `json:"label"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	in.Token = strings.TrimSpace(in.Token)
	if !expoTokenValid(in.Token) {
		return Fail(http.StatusBadRequest, "bad_request", "token must be an Expo push token", nil)
	}
	ch, err := s.deps.Store.UpsertAlertChannel(c.Request().Context(), store.UpsertAlertChannelParams{
		ID: uuid.NewString(), UserID: uid, Kind: "expo", Target: in.Token, Label: in.Label,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not register push token", nil)
	}
	return c.JSON(http.StatusOK, toAlertChannelDTO(ch))
}

func (s *Server) handleUnregisterPushToken(c *echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		Token string `json:"token"`
	}
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Token) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "token is required", nil)
	}
	if _, err := s.deps.Store.DeleteAlertChannelByTarget(c.Request().Context(), store.DeleteAlertChannelByTargetParams{
		UserID: uid, Kind: "expo", Target: strings.TrimSpace(in.Token),
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not remove push token", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
