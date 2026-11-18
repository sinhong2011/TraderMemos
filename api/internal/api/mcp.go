package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/version"
)

/*
The MCP endpoint lets external AI assistants (Grok via the xAI API, Claude,
ChatGPT, Cursor, any Model Context Protocol client) read and — when the user
allows it — write the journal.

Shape:

  - Streamable HTTP, stateless, JSON responses. Every POST is self-contained,
    so the endpoint needs no session store, survives restarts, and works behind
    any reverse proxy that already forwards /api/v1.
  - Authenticated with a personal access token only. A session JWT is refused:
    sessions expire in minutes and cannot be revoked one by one, while a PAT
    is named, listed, audited (last use, client IP/agent) and revocable.
  - Per-user opt-in (Settings → MCP). A token that already exists does not
    start answering MCP clients until its owner turns MCP on, and write tools
    are not even listed until they turn on write access.
  - Tools do not reimplement the API. Each one replays a request through the
    REST router with the caller's own token, so validation, ownership checks
    and user scoping are exactly the REST API's — the same code the web app
    and the isolation tests exercise. A revoked token stops working mid-session
    because every tool call re-authenticates.

Tool annotations (readOnlyHint, destructiveHint, …) describe behavior for the
client's UI. They are hints, never controls: authorization is the token plus
the per-user write switch, enforced here on the server.
*/

const mcpPath = "/api/v1/mcp"

// mcpCaller is the authenticated MCP request, carried into the per-request
// MCP server so each tool replays its REST call as the same principal from the
// same client.
type mcpCaller struct {
	userID      string
	allowWrites bool
	// authorization is the normalized "Bearer tm_pat_…" header. Held in memory
	// for the life of one request and never logged.
	authorization string
	remoteAddr    string
	userAgent     string
	forwardedFor  string
	realIP        string
}

type mcpCallerKey struct{}

func (s *Server) mcpRoutes() {
	if !s.deps.MCPEnabled {
		return
	}
	schemas := mcp.NewSchemaCache()
	handler := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		caller, ok := r.Context().Value(mcpCallerKey{}).(*mcpCaller)
		if !ok {
			// Unreachable: mcpAuth runs first. Fail closed with no tools.
			return mcp.NewServer(mcpImplementation(), nil)
		}
		return s.newMCPServer(caller, schemas)
	}, &mcp.StreamableHTTPOptions{
		Stateless:    true,
		JSONResponse: true,
		// The SDK's DNS-rebinding guard rejects requests that reach a loopback
		// address with a non-loopback Host — which is every request on the usual
		// self-hosted setup (Caddy/nginx on the box proxying to 127.0.0.1). The
		// guard exists for unauthenticated local servers; this one requires a
		// bearer token a rebinding page cannot obtain.
		DisableLocalhostProtection: true,
	})
	h := echo.WrapHandler(handler)
	// GET (server→client stream) and DELETE (session end) answer 405 in
	// stateless mode; routing them keeps that answer spec-shaped instead of a
	// generic 404.
	for _, m := range []string{http.MethodPost, http.MethodGet, http.MethodDelete} {
		s.Echo.Add(m, mcpPath, h, s.mcpAuth)
	}
}

func mcpImplementation() *mcp.Implementation {
	return &mcp.Implementation{
		Name:       "tradermemos",
		Title:      "TraderMemos",
		Version:    version.Version,
		WebsiteURL: "https://github.com/tradermemos",
	}
}

// bearerPAT extracts a personal access token from an Authorization header.
// Accepts "Bearer tm_pat_…" and, because xAI's remote-MCP `authorization`
// field does not document whether it adds the scheme, a bare "tm_pat_…" and
// a doubled "Bearer Bearer tm_pat_…".
func bearerPAT(header string) (string, bool) {
	header = strings.TrimSpace(header)
	// Strip the scheme up to twice: a client that prepends "Bearer " to a
	// value the user already prefixed sends "Bearer Bearer tm_pat_…".
	for range 2 {
		scheme, rest, ok := strings.Cut(header, " ")
		if !ok || !strings.EqualFold(scheme, "Bearer") {
			break
		}
		header = strings.TrimSpace(rest)
	}
	if !auth.IsPAT(header) {
		return "", false
	}
	return header, true
}

func mcpUnauthorized(c *echo.Context, errCode, msg string) error {
	challenge := `Bearer realm="TraderMemos MCP"`
	if errCode != "" {
		challenge += `, error="` + errCode + `"`
	}
	c.Response().Header().Set("WWW-Authenticate", challenge)
	return Fail(http.StatusUnauthorized, "unauthorized", msg, nil)
}

// mcpAuth authenticates the PAT, checks the owner's MCP switches, and hands
// the caller to the MCP handler through the request context.
func (s *Server) mcpAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		if s.deps.Store == nil {
			return Fail(http.StatusServiceUnavailable, "unavailable", "store not configured", nil)
		}
		req := c.Request()
		raw := req.Header.Get("Authorization")
		if raw == "" {
			return mcpUnauthorized(c, "",
				"MCP requires a TraderMemos personal access token: Authorization: Bearer tm_pat_…")
		}
		secret, ok := bearerPAT(raw)
		if !ok {
			// Includes a valid session JWT: MCP is PAT-only by design.
			return mcpUnauthorized(c, "invalid_token",
				"MCP accepts only personal access tokens (tm_pat_…); create one under Settings → API → Access tokens")
		}
		uid, err := auth.AuthenticatePAT(c, s.deps.Store, secret)
		if err != nil {
			return mcpUnauthorized(c, "invalid_token", "invalid, expired or revoked token")
		}
		settings, err := s.loadMCPSettings(req.Context(), uid)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not read MCP settings", nil).Wrap(err)
		}
		if settings.Enabled == 0 {
			return Fail(http.StatusForbidden, "mcp_disabled",
				"MCP access is turned off for this account; enable it in TraderMemos under Settings → API → MCP for AI assistants", nil)
		}
		auth.SetUser(c, uid, true)
		caller := &mcpCaller{
			userID:        uid,
			allowWrites:   settings.AllowWrites != 0,
			authorization: "Bearer " + secret,
			remoteAddr:    req.RemoteAddr,
			userAgent:     req.UserAgent(),
			forwardedFor:  req.Header.Get(echo.HeaderXForwardedFor),
			realIP:        req.Header.Get(echo.HeaderXRealIP),
		}
		c.SetRequest(req.WithContext(context.WithValue(req.Context(), mcpCallerKey{}, caller)))
		return next(c)
	}
}

// loadMCPSettings returns the stored switches, or both off when none exist.
func (s *Server) loadMCPSettings(ctx context.Context, uid string) (store.McpSetting, error) {
	row, err := s.deps.Store.GetMCPSettings(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return store.McpSetting{UserID: uid}, nil
	}
	return row, err
}

// mcpCall replays one REST request as the MCP caller. It goes through the
// full router — auth middleware included — so it cannot reach anything the
// caller's token could not reach over HTTP.
func (s *Server) mcpCall(ctx context.Context, caller *mcpCaller, method, path string, query url.Values, body any) (int, []byte, error) {
	target := "/api/v1" + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	var rdr io.Reader = http.NoBody
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, fmt.Errorf("encode request: %w", err)
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, rdr)
	if err != nil {
		return 0, nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", caller.authorization)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	// Same client identity as the MCP request, so the token's use history
	// shows the assistant rather than a loopback address.
	req.Header.Set("User-Agent", caller.userAgent)
	req.RemoteAddr = caller.remoteAddr
	if caller.forwardedFor != "" {
		req.Header.Set(echo.HeaderXForwardedFor, caller.forwardedFor)
	}
	if caller.realIP != "" {
		req.Header.Set(echo.HeaderXRealIP, caller.realIP)
	}
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	return rec.Code, rec.Body.Bytes(), nil
}

// pathID escapes a client-supplied id for use as one path segment, so an id
// like "../accounts" cannot steer the replayed request to another route.
func pathID(id string) string { return url.PathEscape(strings.TrimSpace(id)) }
