package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/flexsync"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) flexSyncRoutes(g *echo.Group) {
	g.GET("/accounts/:id/flex-sync", s.handleGetFlexSync)
	g.PUT("/accounts/:id/flex-sync", s.handlePutFlexSync)
	g.DELETE("/accounts/:id/flex-sync", s.handleDeleteFlexSync)
	g.POST("/accounts/:id/flex-sync/run", s.handleRunFlexSync)
}

type flexSyncDTO struct {
	Configured   bool   `json:"configured"`
	Enabled      bool   `json:"enabled"`
	QueryID      string `json:"query_id,omitempty"`
	TokenSet     bool   `json:"token_set"`
	TokenHint    string `json:"token_hint,omitempty"`
	LastSyncedAt string `json:"last_synced_at,omitempty"`
	LastStatus   string `json:"last_status,omitempty"`
	LastError    string `json:"last_error,omitempty"`
}

type flexSyncPutDTO struct {
	QueryID string `json:"query_id"`
	Enabled bool   `json:"enabled"`
	// Token optional on update — empty keeps the existing token.
	Token *string `json:"token"`
}

func tokenHint(token string) string {
	if len(token) <= 4 {
		return ""
	}
	return "…" + token[len(token)-4:]
}

func toFlexSyncDTO(r store.FlexSyncSetting) flexSyncDTO {
	dto := flexSyncDTO{
		Configured: true,
		Enabled:    r.Enabled != 0,
		QueryID:    r.QueryID,
		TokenSet:   r.Token != "",
		TokenHint:  tokenHint(r.Token),
		LastStatus: r.LastStatus,
		LastError:  r.LastError,
	}
	if r.LastSyncedAt.Valid {
		dto.LastSyncedAt = r.LastSyncedAt.Time.UTC().Format(time.RFC3339)
	}
	return dto
}

func (s *Server) handleGetFlexSync(c *echo.Context) error {
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	row, err := s.deps.Store.GetFlexSyncSettings(c.Request().Context(), store.GetFlexSyncSettingsParams{
		AccountID: acct.ID, UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, flexSyncDTO{Configured: false})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load flex sync settings", nil)
	}
	return c.JSON(http.StatusOK, toFlexSyncDTO(row))
}

func (s *Server) handlePutFlexSync(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	var in flexSyncPutDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	in.QueryID = strings.TrimSpace(in.QueryID)
	if in.QueryID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "query_id is required", nil)
	}

	token := ""
	if in.Token != nil && strings.TrimSpace(*in.Token) != "" {
		token = strings.TrimSpace(*in.Token)
	} else {
		cur, err := s.deps.Store.GetFlexSyncSettings(ctx, store.GetFlexSyncSettingsParams{
			AccountID: acct.ID, UserID: uid,
		})
		if errors.Is(err, sql.ErrNoRows) {
			return Fail(http.StatusBadRequest, "bad_request", "token is required", nil)
		}
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not load flex sync settings", nil)
		}
		token = cur.Token
	}

	enabled := int64(0)
	if in.Enabled {
		enabled = 1
	}
	row, err := s.deps.Store.UpsertFlexSyncSettings(ctx, store.UpsertFlexSyncSettingsParams{
		AccountID: acct.ID, UserID: uid, Token: token, QueryID: in.QueryID, Enabled: enabled,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save flex sync settings", nil)
	}
	return c.JSON(http.StatusOK, toFlexSyncDTO(row))
}

func (s *Server) handleDeleteFlexSync(c *echo.Context) error {
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	if _, err := s.deps.Store.DeleteFlexSyncSettings(c.Request().Context(), store.DeleteFlexSyncSettingsParams{
		AccountID: acct.ID, UserID: auth.UserID(c),
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete flex sync settings", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

// handleRunFlexSync triggers one synchronous sync. IBKR statement generation
// can take tens of seconds; the UI shows a progress state meanwhile.
func (s *Server) handleRunFlexSync(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	row, err := s.deps.Store.GetFlexSyncSettings(ctx, store.GetFlexSyncSettingsParams{
		AccountID: acct.ID, UserID: uid,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusUnprocessableEntity, "unprocessable", "flex sync is not configured for this account", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load flex sync settings", nil)
	}
	if s.deps.FlexClient == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "flex sync is not available", nil)
	}

	res, syncErr := flexsync.Sync(ctx, s.deps.Store, s.deps.FlexClient, row)
	flexsync.RecordOutcome(ctx, s.deps.Store, row, res, syncErr)
	if syncErr != nil {
		return Fail(http.StatusBadGateway, "upstream_error", syncErr.Error(), nil)
	}
	return c.JSON(http.StatusOK, res)
}
