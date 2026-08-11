package api

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) accessTokenRoutes(g *echo.Group) {
	g.GET("/access-tokens", s.handleListAccessTokens)
	g.POST("/access-tokens", s.handleCreateAccessToken)
	g.DELETE("/access-tokens/:id", s.handleRevokeAccessToken)
	g.GET("/access-tokens/:id/uses", s.handleListAccessTokenUses)
}

type createAccessTokenReq struct {
	Name          string `json:"name"`
	ExpiresInDays *int   `json:"expires_in_days"`
}

type accessTokenDTO struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	TokenPrefix string  `json:"token_prefix"`
	CreatedAt   string  `json:"created_at"`
	ExpiresAt   *string `json:"expires_at"`
	LastUsedAt  *string `json:"last_used_at"`
}

type createAccessTokenResp struct {
	accessTokenDTO
	Token string `json:"token"`
}

func accessTokenToDTO(row store.AccessToken) accessTokenDTO {
	dto := accessTokenDTO{
		ID:          row.ID,
		Name:        row.Name,
		TokenPrefix: row.TokenPrefix,
		CreatedAt:   row.CreatedAt.UTC().Format(time.RFC3339),
	}
	if row.ExpiresAt.Valid {
		s := row.ExpiresAt.Time.UTC().Format(time.RFC3339)
		dto.ExpiresAt = &s
	}
	if row.LastUsedAt.Valid {
		s := row.LastUsedAt.Time.UTC().Format(time.RFC3339)
		dto.LastUsedAt = &s
	}
	return dto
}

func (s *Server) handleListAccessTokens(c *echo.Context) error {
	rows, err := s.deps.Store.ListAccessTokensByUser(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list access tokens", nil)
	}
	out := make([]accessTokenDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, accessTokenToDTO(row))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleCreateAccessToken(c *echo.Context) error {
	var in createAccessTokenReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	if len(name) > 80 {
		return Fail(http.StatusBadRequest, "bad_request", "name must be 80 characters or fewer", nil)
	}

	var expiresAt sql.NullTime
	if in.ExpiresInDays != nil {
		days := *in.ExpiresInDays
		switch days {
		case 30, 90, 365:
			expiresAt = sql.NullTime{Time: time.Now().UTC().AddDate(0, 0, days), Valid: true}
		default:
			return Fail(http.StatusBadRequest, "bad_request", "expires_in_days must be 30, 90, or 365", nil)
		}
	}

	secret, err := auth.GeneratePAT()
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not generate token", nil)
	}

	row, err := s.deps.Store.CreateAccessToken(c.Request().Context(), store.CreateAccessTokenParams{
		ID:          uuid.NewString(),
		UserID:      auth.UserID(c),
		Name:        name,
		TokenPrefix: auth.DisplayPrefix(secret),
		TokenHash:   auth.HashPAT(secret),
		ExpiresAt:   expiresAt,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create access token", nil)
	}

	return c.JSON(http.StatusCreated, createAccessTokenResp{
		accessTokenDTO: accessTokenToDTO(row),
		Token:          secret,
	})
}

func (s *Server) handleRevokeAccessToken(c *echo.Context) error {
	n, err := s.deps.Store.RevokeAccessToken(c.Request().Context(), store.RevokeAccessTokenParams{
		ID:     c.Param("id"),
		UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not revoke access token", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "access token not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

type accessTokenUseDTO struct {
	UsedAt string `json:"used_at"`
	IP     string `json:"ip"`
	// Raw and unparsed. Turning "curl/8.4.0" into "curl" is guesswork, and the
	// point of this screen is recognising your own tooling — the full string is
	// what you actually match against.
	UserAgent string `json:"user_agent"`
}

// Where a token has been used from. `last_used_at` answers "recently?"; this
// answers "by what?", which is the question you ask when a token might have
// leaked.
func (s *Server) handleListAccessTokenUses(c *echo.Context) error {
	if s.deps.Store == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "store not configured", nil)
	}
	// Scoped by user_id in the query, so one user cannot read another's
	// history by guessing a token id.
	rows, err := s.deps.Store.ListAccessTokenUses(c.Request().Context(),
		store.ListAccessTokenUsesParams{
			TokenID: c.Param("id"),
			UserID:  auth.UserID(c),
			Limit:   50,
		})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list uses", nil)
	}
	out := make([]accessTokenUseDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, accessTokenUseDTO{
			UsedAt:    r.UsedAt.UTC().Format(time.RFC3339),
			IP:        r.Ip,
			UserAgent: r.UserAgent,
		})
	}
	return c.JSON(http.StatusOK, out)
}
