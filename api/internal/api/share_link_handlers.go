package api

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) shareLinkRoutes(g *echo.Group) {
	g.GET("/share-links", s.handleListShareLinks)
	g.POST("/share-links", s.handleCreateShareLink)
	g.DELETE("/share-links/:id", s.handleRevokeShareLink)
}

func (s *Server) publicShareRoutes(g *echo.Group) {
	g.GET("/share/:token", s.handlePublicShare)
}

// shareScope is the snapshot stored in share_links.scope_json: which slice of
// the journal a link exposes, and whether absolute amounts are allowed. It is
// enforced server-side by the public handler on every request.
type shareScope struct {
	AccountID string `json:"account_id,omitempty"`
	From      string `json:"from,omitempty"` // RFC3339
	To        string `json:"to,omitempty"`   // RFC3339
	// Tz buckets days/months (IANA name); empty = UTC.
	Tz          string `json:"tz,omitempty"`
	ShowAmounts bool   `json:"show_amounts"`
	// Currency labels amounts when ShowAmounts; chosen at share time.
	Currency string `json:"currency,omitempty"`
}

type createShareLinkReq struct {
	shareScope
	// ExpiresInDays: nil = the 90-day default, 0 = never (explicit opt-out).
	ExpiresInDays *int `json:"expires_in_days"`
}

type shareLinkDTO struct {
	ID        string     `json:"id"`
	Token     string     `json:"token"`
	Scope     shareScope `json:"scope"`
	CreatedAt string     `json:"created_at"`
	ExpiresAt *string    `json:"expires_at"`
	ViewCount int64      `json:"view_count"`
}

func shareLinkToDTO(row store.ShareLink) shareLinkDTO {
	dto := shareLinkDTO{
		ID:        row.ID,
		Token:     row.Token,
		CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ViewCount: row.ViewCount,
	}
	// A scope that fails to parse renders as the zero scope — the public
	// handler applies the same fallback, so the two stay consistent.
	_ = json.Unmarshal([]byte(row.ScopeJson), &dto.Scope)
	if row.ExpiresAt.Valid {
		v := row.ExpiresAt.Time.UTC().Format(time.RFC3339)
		dto.ExpiresAt = &v
	}
	return dto
}

// generateShareToken returns a 256-bit URL-safe token. Unlike PATs it is
// stored as-is: the token is the URL, and the owner must be able to re-copy
// it from the list view later.
func generateShareToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

func (s *Server) shareLinksDisabled() error {
	return Fail(http.StatusNotFound, "share_links_disabled", "share links are disabled on this server", nil)
}

func (s *Server) handleListShareLinks(c *echo.Context) error {
	if !s.deps.ShareLinksEnabled {
		return s.shareLinksDisabled()
	}
	rows, err := s.deps.Store.ListShareLinksByUser(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list share links", nil)
	}
	out := make([]shareLinkDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, shareLinkToDTO(row))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleCreateShareLink(c *echo.Context) error {
	if !s.deps.ShareLinksEnabled {
		return s.shareLinksDisabled()
	}
	var in createShareLinkReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.From != "" {
		if _, err := time.Parse(time.RFC3339, in.From); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "invalid 'from' date (want RFC3339)", nil)
		}
	}
	if in.To != "" {
		if _, err := time.Parse(time.RFC3339, in.To); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "invalid 'to' date (want RFC3339)", nil)
		}
	}
	if in.Tz != "" {
		if _, err := time.LoadLocation(in.Tz); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "invalid 'tz' (want IANA timezone name)", nil)
		}
	}
	if len(in.Currency) > 8 {
		return Fail(http.StatusBadRequest, "bad_request", "invalid 'currency'", nil)
	}
	if in.AccountID != "" {
		// Creating a link for someone else's account id must fail loudly, not
		// mint a link that quietly shows an empty record.
		if _, err := s.deps.Store.GetAccount(c.Request().Context(), store.GetAccountParams{
			ID: in.AccountID, UserID: auth.UserID(c),
		}); err != nil {
			return Fail(http.StatusNotFound, "not_found", "account not found", nil)
		}
	}

	days := 90
	if in.ExpiresInDays != nil {
		days = *in.ExpiresInDays
	}
	if days < 0 || days > 730 {
		return Fail(http.StatusBadRequest, "bad_request", "expires_in_days must be between 0 (never) and 730", nil)
	}
	var expiresAt sql.NullTime
	if days > 0 {
		expiresAt = sql.NullTime{Time: time.Now().UTC().AddDate(0, 0, days), Valid: true}
	}

	token, err := generateShareToken()
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not generate token", nil)
	}
	scopeJSON, err := json.Marshal(in.shareScope)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not encode scope", nil)
	}

	row, err := s.deps.Store.CreateShareLink(c.Request().Context(), store.CreateShareLinkParams{
		ID:        uuid.NewString(),
		UserID:    auth.UserID(c),
		Token:     token,
		ScopeJson: string(scopeJSON),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create share link", nil)
	}
	return c.JSON(http.StatusCreated, shareLinkToDTO(row))
}

func (s *Server) handleRevokeShareLink(c *echo.Context) error {
	if !s.deps.ShareLinksEnabled {
		return s.shareLinksDisabled()
	}
	n, err := s.deps.Store.RevokeShareLink(c.Request().Context(), store.RevokeShareLinkParams{
		ID:     c.Param("id"),
		UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not revoke share link", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "share link not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

type publicShareDTO struct {
	analytics.ShareAggregate
	Currency string `json:"currency,omitempty"`
}

// handlePublicShare is the only unauthenticated read of journal data. It never
// reuses the authed handlers: the response is the dedicated aggregate built by
// analytics.BuildShareAggregate, with the scope enforced here on every hit.
// Disabled, unknown, revoked, and expired all answer the same 404.
func (s *Server) handlePublicShare(c *echo.Context) error {
	notFound := Fail(http.StatusNotFound, "not_found", "share link not found", nil)
	if !s.deps.ShareLinksEnabled {
		return notFound
	}
	token := c.Param("token")
	if token == "" || len(token) > 128 {
		return notFound
	}
	row, err := s.deps.Store.GetShareLinkByToken(c.Request().Context(), token)
	if err != nil {
		return notFound
	}
	if subtle.ConstantTimeCompare([]byte(row.Token), []byte(token)) != 1 {
		return notFound
	}
	if row.ExpiresAt.Valid && time.Now().UTC().After(row.ExpiresAt.Time) {
		return notFound
	}

	var scope shareScope
	_ = json.Unmarshal([]byte(row.ScopeJson), &scope)
	f := Filters{Loc: time.UTC}
	if scope.AccountID != "" {
		f.AccountIDs = []string{scope.AccountID}
	}
	if scope.Tz != "" {
		if loc, err := time.LoadLocation(scope.Tz); err == nil {
			f.Loc = loc
		}
	}
	if scope.From != "" {
		if t, err := time.Parse(time.RFC3339, scope.From); err == nil {
			f.From = &t
		}
	}
	if scope.To != "" {
		if t, err := time.Parse(time.RFC3339, scope.To); err == nil {
			f.To = &t
		}
	}

	rows, err := s.loadClosedTrades(c.Request().Context(), row.UserID, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load shared summary", nil)
	}
	bySymbol := map[string][]analytics.ClosedTrade{}
	for _, t := range rows {
		bySymbol[t.Symbol] = append(bySymbol[t.Symbol], toClosedTrades([]store.Trade{t})...)
	}
	agg := analytics.BuildShareAggregate(analytics.ShareInput{
		Trades:      toClosedTrades(rows),
		BySymbol:    bySymbol,
		Loc:         f.Loc,
		ShowAmounts: scope.ShowAmounts,
	})

	// Best-effort: a lost increment must not fail the page.
	_ = s.deps.Store.IncrementShareLinkViews(c.Request().Context(), row.ID)

	out := publicShareDTO{ShareAggregate: agg}
	if scope.ShowAmounts {
		out.Currency = scope.Currency
		if out.Currency == "" {
			out.Currency = "USD"
		}
	}
	return c.JSON(http.StatusOK, out)
}
