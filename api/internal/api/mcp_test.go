package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// All data in these tests is synthetic: made-up accounts, symbols and prices.

const mcpEndpoint = "/api/v1/mcp"

// syncBuffer collects log output from concurrent handlers.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func mcpTestServer(t *testing.T, mcpEnabled bool) (*api.Server, *syncBuffer) {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.NewForDriver(conn, "sqlite")
	j := auth.NewJWT("test")
	logs := &syncBuffer{}
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Storage:        storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")),
		AttachMaxBytes: 10 << 20,
		Logger:         slog.New(slog.NewJSONHandler(logs, &slog.HandlerOptions{Level: slog.LevelDebug})),
		MCPEnabled:     mcpEnabled,
	}), logs
}

func createPAT(t *testing.T, s *api.Server, jwtTok string) (id, secret string) {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/access-tokens", `{"name":"assistant"}`, jwtTok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var out struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out.ID, out.Token
}

func setMCP(t *testing.T, s *api.Server, jwtTok string, enabled, writes bool) {
	t.Helper()
	body, _ := json.Marshal(map[string]bool{"enabled": enabled, "allow_writes": writes})
	rec := do(s, http.MethodPut, "/api/v1/settings/mcp", string(body), jwtTok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func createAccount(t *testing.T, s *api.Server, jwtTok, name string) string {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/accounts", `{"name":"`+name+`","base_currency":"USD"}`, jwtTok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var out struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out.ID
}

// headerRT injects the Authorization header the way a configured MCP client
// (Grok Build --header, xAI `authorization`, Claude Code headers) does.
type headerRT struct {
	value string
	base  http.RoundTripper
}

func (h headerRT) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", h.value)
	return h.base.RoundTrip(r)
}

func connectMCP(t *testing.T, srv *httptest.Server, authz string) *mcp.ClientSession {
	t.Helper()
	cs, err := tryConnectMCP(srv, authz)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Close() })
	return cs
}

func tryConnectMCP(srv *httptest.Server, authz string) (*mcp.ClientSession, error) {
	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "1"}, nil)
	return client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:   srv.URL + mcpEndpoint,
		HTTPClient: &http.Client{Transport: headerRT{value: authz, base: http.DefaultTransport}},
		MaxRetries: -1,
	}, nil)
}

func callTool(t *testing.T, cs *mcp.ClientSession, name string, args map[string]any) (string, bool) {
	t.Helper()
	res, err := cs.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	require.NoError(t, err, name)
	require.NotEmpty(t, res.Content, name)
	text := res.Content[0].(*mcp.TextContent).Text
	return text, res.IsError
}

func callOK(t *testing.T, cs *mcp.ClientSession, name string, args map[string]any) string {
	t.Helper()
	text, isErr := callTool(t, cs, name, args)
	require.False(t, isErr, "%s: %s", name, text)
	return text
}

func toolNames(t *testing.T, cs *mcp.ClientSession) []string {
	t.Helper()
	res, err := cs.ListTools(context.Background(), nil)
	require.NoError(t, err)
	var names []string
	for _, tool := range res.Tools {
		names = append(names, tool.Name)
	}
	slices.Sort(names)
	return names
}

var writeTools = []string{"create_note", "delete_note", "delete_trade", "log_execution", "update_note", "update_trade_journal"}

func TestMCPAuthentication(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "auth@example.com")
	tokID, pat := createPAT(t, s, jwtTok)

	post := func(authz string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, mcpEndpoint,
			strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Accept", "application/json, text/event-stream")
		if authz != "" {
			r.Header.Set("Authorization", authz)
		}
		rec := httptest.NewRecorder()
		s.Echo.ServeHTTP(rec, r)
		return rec
	}

	t.Run("missing token", func(t *testing.T) {
		rec := post("")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		require.Contains(t, rec.Header().Get("WWW-Authenticate"), "Bearer")
	})
	t.Run("session JWT is refused", func(t *testing.T) {
		rec := post("Bearer " + jwtTok)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		require.Contains(t, rec.Body.String(), "personal access token")
	})
	t.Run("unknown PAT", func(t *testing.T) {
		rec := post("Bearer tm_pat_doesnotexist")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		require.Contains(t, rec.Header().Get("WWW-Authenticate"), `error="invalid_token"`)
	})
	t.Run("valid PAT but MCP off by default", func(t *testing.T) {
		rec := post("Bearer " + pat)
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Contains(t, rec.Body.String(), "mcp_disabled")
	})

	setMCP(t, s, jwtTok, true, false)
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)

	t.Run("Bearer PAT connects", func(t *testing.T) {
		cs := connectMCP(t, srv, "Bearer "+pat)
		require.Equal(t, "tradermemos", cs.InitializeResult().ServerInfo.Name)
	})
	t.Run("bare PAT connects (xAI authorization field)", func(t *testing.T) {
		connectMCP(t, srv, pat)
	})
	t.Run("doubled Bearer prefix connects", func(t *testing.T) {
		connectMCP(t, srv, "Bearer Bearer "+pat)
	})
	t.Run("lowercase scheme connects", func(t *testing.T) {
		connectMCP(t, srv, "bearer "+pat)
	})
	t.Run("PAT in query string is ignored", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodPost, mcpEndpoint+"?access_token="+pat,
			strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
		r.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		s.Echo.ServeHTTP(rec, r)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})
	t.Run("revoked token stops working mid-session", func(t *testing.T) {
		cs := connectMCP(t, srv, "Bearer "+pat)
		callOK(t, cs, "list_accounts", nil)
		rec := do(s, http.MethodDelete, "/api/v1/access-tokens/"+tokID, "", jwtTok)
		require.Equal(t, http.StatusNoContent, rec.Code)
		_, err := cs.CallTool(context.Background(), &mcp.CallToolParams{Name: "list_accounts"})
		require.Error(t, err)
		_, err = tryConnectMCP(srv, "Bearer "+pat)
		require.Error(t, err)
	})
}

func TestMCPSettingsEndpoint(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "settings@example.com")
	_, pat := createPAT(t, s, jwtTok)

	rec := do(s, http.MethodGet, "/api/v1/settings/mcp", "", jwtTok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["available"])
	require.Equal(t, false, got["enabled"], "MCP is opt-in")
	require.Equal(t, false, got["allow_writes"], "writes are opt-in")
	require.Equal(t, mcpEndpoint, got["endpoint_path"])

	// A PAT can read the settings but never change them — the token given to
	// an assistant must not be able to grant itself write access.
	rec = do(s, http.MethodGet, "/api/v1/settings/mcp", "", pat)
	require.Equal(t, http.StatusOK, rec.Code)
	rec = do(s, http.MethodPut, "/api/v1/settings/mcp", `{"enabled":true,"allow_writes":true}`, pat)
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Contains(t, rec.Body.String(), "session_required")

	rec = do(s, http.MethodPut, "/api/v1/settings/mcp", `{"enabled":true}`, jwtTok)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	setMCP(t, s, jwtTok, true, true)
	rec = do(s, http.MethodGet, "/api/v1/settings/mcp", "", jwtTok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["enabled"])
	require.Equal(t, true, got["allow_writes"])
}

func TestMCPDisabledForInstance(t *testing.T) {
	s, _ := mcpTestServer(t, false)
	jwtTok := registerAndLogin(t, s, "off@example.com")
	_, pat := createPAT(t, s, jwtTok)
	setMCP(t, s, jwtTok, true, true)

	rec := do(s, http.MethodPost, mcpEndpoint, `{}`, pat)
	require.Equal(t, http.StatusNotFound, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/settings/mcp", "", jwtTok)
	require.Contains(t, rec.Body.String(), `"available":false`)
}

func TestMCPReadOnlyByDefault(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "ro@example.com")
	_, pat := createPAT(t, s, jwtTok)
	setMCP(t, s, jwtTok, true, false)
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)
	cs := connectMCP(t, srv, "Bearer "+pat)

	names := toolNames(t, cs)
	for _, w := range writeTools {
		require.NotContains(t, names, w, "write tool listed on a read-only connection")
	}
	require.Contains(t, names, "list_trades")

	// Calling an unlisted write tool is refused, not executed.
	res, err := cs.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_note", Arguments: map[string]any{"body": "x"},
	})
	if err == nil {
		require.True(t, res.IsError)
	}
	rec := do(s, http.MethodGet, "/api/v1/notes", "", jwtTok)
	require.JSONEq(t, `[]`, rec.Body.String())

	info := callOK(t, cs, "get_connection_info", nil)
	require.Contains(t, info, `"access":"read_only"`)

	// Every listed tool is annotated read-only.
	list, err := cs.ListTools(context.Background(), nil)
	require.NoError(t, err)
	for _, tool := range list.Tools {
		require.NotNil(t, tool.Annotations, tool.Name)
		require.True(t, tool.Annotations.ReadOnlyHint, tool.Name)
	}

	// Turning writes on takes effect on the next request, no reconnect needed.
	setMCP(t, s, jwtTok, true, true)
	names = toolNames(t, cs)
	for _, w := range writeTools {
		require.Contains(t, names, w)
	}
	// …and off again.
	setMCP(t, s, jwtTok, true, false)
	require.NotContains(t, toolNames(t, cs), "delete_trade")
	// Turning MCP off cuts the connection.
	setMCP(t, s, jwtTok, false, false)
	_, err = cs.ListTools(context.Background(), nil)
	require.Error(t, err)
}

func TestMCPToolAnnotations(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "ann@example.com")
	_, pat := createPAT(t, s, jwtTok)
	setMCP(t, s, jwtTok, true, true)
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)
	cs := connectMCP(t, srv, "Bearer "+pat)

	list, err := cs.ListTools(context.Background(), nil)
	require.NoError(t, err)
	byName := map[string]*mcp.Tool{}
	for _, tool := range list.Tools {
		byName[tool.Name] = tool
		a := tool.Annotations
		require.NotNil(t, a, tool.Name)
		require.NotNil(t, a.OpenWorldHint, tool.Name)
		require.False(t, *a.OpenWorldHint, "%s touches only this journal", tool.Name)
		require.NotEmpty(t, a.Title, tool.Name)
	}
	for _, w := range writeTools {
		require.False(t, byName[w].Annotations.ReadOnlyHint, w)
	}
	for _, d := range []string{"delete_trade", "delete_note", "update_note", "update_trade_journal"} {
		require.True(t, *byName[d].Annotations.DestructiveHint, d)
	}
	for _, a := range []string{"create_note", "log_execution"} {
		require.False(t, *byName[a].Annotations.DestructiveHint, a)
	}
	require.True(t, byName["log_execution"].Annotations.IdempotentHint, "fills are deduplicated")
	require.False(t, byName["create_note"].Annotations.IdempotentHint)
}

func TestMCPToolsEndToEnd(t *testing.T) {
	s, logs := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "e2e@example.com")
	_, pat := createPAT(t, s, jwtTok)
	setMCP(t, s, jwtTok, true, true)
	acct := createAccount(t, s, jwtTok, "Paper")
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)
	cs := connectMCP(t, srv, "Bearer "+pat)

	require.Contains(t, callOK(t, cs, "list_accounts", nil), acct)

	// A round trip: buy then sell builds one closed trade.
	buy := callOK(t, cs, "log_execution", map[string]any{
		"account_id": acct, "symbol": "zzzt", "side": "buy", "quantity": 10, "price": 100,
		"executed_at": "2026-03-02T14:30:00Z",
	})
	var fill struct {
		TradeID string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal([]byte(buy), &fill))
	require.NotEmpty(t, fill.TradeID)
	// Same fill again is deduplicated, not doubled.
	again := callOK(t, cs, "log_execution", map[string]any{
		"account_id": acct, "symbol": "ZZZT", "side": "buy", "quantity": 10, "price": 100,
		"executed_at": "2026-03-02T14:30:00Z",
	})
	require.Contains(t, again, `"deduped":"true"`)
	callOK(t, cs, "log_execution", map[string]any{
		"account_id": acct, "symbol": "ZZZT", "side": "sell", "quantity": 10, "price": 105,
		"executed_at": "2026-03-02T15:00:00Z",
	})

	var page struct {
		Total int               `json:"total"`
		Items []json.RawMessage `json:"items"`
	}
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_trades", map[string]any{"status": "closed"})), &page))
	require.Equal(t, 1, page.Total)
	var tr struct {
		ID     string  `json:"id"`
		Symbol string  `json:"symbol"`
		NetPnl float64 `json:"net_pnl"`
	}
	require.NoError(t, json.Unmarshal(page.Items[0], &tr))
	require.Equal(t, "ZZZT", tr.Symbol)
	require.InDelta(t, 50, tr.NetPnl, 0.001)
	tradeID := tr.ID

	// Date filters: a window that excludes the trade, and bare-date bounds that include it.
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_trades",
		map[string]any{"from": "2026-04-01"})), &page))
	require.Equal(t, 0, page.Total)
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_trades",
		map[string]any{"from": "2026-03-02", "to": "2026-03-02"})), &page))
	require.Equal(t, 1, page.Total)
	// Pagination.
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_trades",
		map[string]any{"limit": 1, "offset": 1})), &page))
	require.Equal(t, 1, page.Total)
	require.Empty(t, page.Items)

	// Analytics.
	summary := callOK(t, cs, "get_analytics", map[string]any{"report": "summary"})
	require.Contains(t, summary, "50")
	callOK(t, cs, "get_analytics", map[string]any{"report": "breakdown", "group_by": "symbol"})
	callOK(t, cs, "get_analytics", map[string]any{"report": "daily", "timezone": "America/New_York"})

	// Journal update, partial.
	callOK(t, cs, "update_trade_journal", map[string]any{
		"trade_id": tradeID, "notes": "Followed the plan.", "confidence": 4,
	})
	callOK(t, cs, "update_trade_journal", map[string]any{"trade_id": tradeID, "trade_quality": 5})
	detail := callOK(t, cs, "get_trade", map[string]any{"trade_id": tradeID})
	require.Contains(t, detail, "Followed the plan.")

	// Tags: attach, then clear with [].
	rec := do(s, http.MethodPost, "/api/v1/tags", `{"name":"breakout"}`, jwtTok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var tag struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tag))
	require.Contains(t, callOK(t, cs, "list_tags", nil), tag.ID)
	require.Contains(t, callOK(t, cs, "update_trade_journal",
		map[string]any{"trade_id": tradeID, "tag_ids": []string{tag.ID}}), "breakout")
	cleared := callOK(t, cs, "update_trade_journal", map[string]any{"trade_id": tradeID, "tag_ids": []string{}})
	require.NotContains(t, cleared, "breakout")
	require.Contains(t, callOK(t, cs, "get_trade", map[string]any{"trade_id": tradeID}), "Followed the plan.",
		"a tags-only update keeps the notes")

	// Notes: create, partial update keeps untouched fields, filter, delete.
	created := callOK(t, cs, "create_note", map[string]any{
		"title": "Premarket", "body": "Watching ZZZT.", "occurred_at": "2026-03-02",
	})
	var note struct {
		ID         string `json:"id"`
		Title      string `json:"title"`
		Body       string `json:"body"`
		OccurredAt string `json:"occurred_at"`
	}
	require.NoError(t, json.Unmarshal([]byte(created), &note))
	updated := callOK(t, cs, "update_note", map[string]any{"note_id": note.ID, "body": "Gap filled."})
	require.NoError(t, json.Unmarshal([]byte(updated), &note))
	require.Equal(t, "Premarket", note.Title)
	require.Equal(t, "Gap filled.", note.Body)
	require.Equal(t, "2026-03-02", note.OccurredAt)
	require.Contains(t, callOK(t, cs, "get_note", map[string]any{"note_id": note.ID}), "Gap filled.")
	var notes struct {
		Total int `json:"total"`
	}
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_notes",
		map[string]any{"from": "2026-03-01", "to": "2026-03-02", "type": "note"})), &notes))
	require.Equal(t, 1, notes.Total)
	require.NoError(t, json.Unmarshal([]byte(callOK(t, cs, "list_notes",
		map[string]any{"type": "daily_log"})), &notes))
	require.Equal(t, 0, notes.Total)
	callOK(t, cs, "delete_note", map[string]any{"note_id": note.ID})
	_, isErr := callTool(t, cs, "get_note", map[string]any{"note_id": note.ID})
	require.True(t, isErr)

	// Delete the trade.
	callOK(t, cs, "delete_trade", map[string]any{"trade_id": tradeID})
	text, isErr := callTool(t, cs, "get_trade", map[string]any{"trade_id": tradeID})
	require.True(t, isErr)
	require.Contains(t, text, "not_found")

	// The token secret never reaches the logs, even though every tool call
	// replayed it through the router.
	require.NotEmpty(t, logs.String())
	require.NotContains(t, logs.String(), pat)
	require.NotContains(t, logs.String(), pat[len(auth.PATPrefix):])
}

func TestMCPToolErrors(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	jwtTok := registerAndLogin(t, s, "err@example.com")
	_, pat := createPAT(t, s, jwtTok)
	setMCP(t, s, jwtTok, true, true)
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)
	cs := connectMCP(t, srv, "Bearer "+pat)

	cases := []struct {
		tool string
		args map[string]any
		want string
	}{
		{"get_trade", map[string]any{"trade_id": "../accounts"}, "trade_id must be an id"},
		{"get_trade", map[string]any{"trade_id": "nope"}, "not_found"},
		{"delete_trade", map[string]any{"trade_id": "nope"}, "not_found"},
		{"get_analytics", map[string]any{"report": "astrology"}, "unknown report"},
		{"get_analytics", map[string]any{"report": "breakdown"}, "group_by"},
		{"get_analytics", map[string]any{"report": "breakdown", "group_by": "moon"}, "by must be one of"},
		{"list_trades", map[string]any{"status": "pending"}, "invalid 'status'"},
		{"list_trades", map[string]any{"from": "last tuesday"}, "invalid 'from'"},
		{"list_trades", map[string]any{"timezone": "Mars/Base"}, "invalid 'tz'"},
		{"list_trades", map[string]any{"limit": -1}, "limit and offset"},
		{"list_notes", map[string]any{"type": "diary"}, "type must be"},
		{"log_execution", map[string]any{
			"account_id": "missing", "symbol": "ZZZT", "side": "buy", "quantity": 1, "price": 1,
			"executed_at": "2026-03-02T14:30:00Z",
		}, "account not found"},
		{"update_trade_journal", map[string]any{"trade_id": "nope", "confidence": 9}, "between 0 and 5"},
		{"create_note", map[string]any{"body": "  "}, "body or symbols required"},
		{"update_note", map[string]any{"note_id": "nope", "body": "x"}, "not_found"},
	}
	for _, tc := range cases {
		text, isErr := callTool(t, cs, tc.tool, tc.args)
		require.True(t, isErr, "%s %v: %s", tc.tool, tc.args, text)
		require.Contains(t, text, tc.want, "%s %v", tc.tool, tc.args)
	}

	// Schema validation: a missing required argument is rejected before the handler runs.
	res, err := cs.CallTool(context.Background(), &mcp.CallToolParams{Name: "get_trade", Arguments: map[string]any{}})
	if err == nil {
		require.True(t, res.IsError)
	}
}

func TestMCPCrossUserIsolation(t *testing.T) {
	s, _ := mcpTestServer(t, true)
	aliceJWT := registerAndLogin(t, s, "alice@example.com")
	bobJWT := registerAndLogin(t, s, "bob@example.com")
	_, alicePAT := createPAT(t, s, aliceJWT)
	_, bobPAT := createPAT(t, s, bobJWT)
	setMCP(t, s, aliceJWT, true, true)
	setMCP(t, s, bobJWT, true, true)
	aliceAcct := createAccount(t, s, aliceJWT, "Alice paper")
	srv := httptest.NewServer(s.Echo)
	t.Cleanup(srv.Close)
	alice := connectMCP(t, srv, "Bearer "+alicePAT)
	bob := connectMCP(t, srv, "Bearer "+bobPAT)

	out := callOK(t, alice, "log_execution", map[string]any{
		"account_id": aliceAcct, "symbol": "ZZZT", "side": "buy", "quantity": 1, "price": 10,
		"executed_at": "2026-03-02T14:30:00Z",
	})
	var fill struct {
		TradeID string `json:"trade_id"`
	}
	require.NoError(t, json.Unmarshal([]byte(out), &fill))
	var note struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal([]byte(callOK(t, alice, "create_note",
		map[string]any{"body": "alice private"})), &note))

	// Bob sees none of it.
	require.JSONEq(t, `[]`, callOK(t, bob, "list_accounts", nil))
	require.Contains(t, callOK(t, bob, "list_trades", nil), `"total":0`)
	require.Contains(t, callOK(t, bob, "list_notes", nil), `"total":0`)
	require.NotContains(t, callOK(t, bob, "get_analytics", map[string]any{"report": "summary"}), "ZZZT")
	// Alice's ids, scoped by account, are also invisible to Bob.
	require.Contains(t, callOK(t, bob, "list_trades", map[string]any{"account_ids": []string{aliceAcct}}), `"total":0`)

	for _, c := range []struct {
		tool string
		args map[string]any
	}{
		{"get_trade", map[string]any{"trade_id": fill.TradeID}},
		{"update_trade_journal", map[string]any{"trade_id": fill.TradeID, "notes": "pwned"}},
		{"delete_trade", map[string]any{"trade_id": fill.TradeID}},
		{"get_note", map[string]any{"note_id": note.ID}},
		{"update_note", map[string]any{"note_id": note.ID, "body": "pwned"}},
		{"delete_note", map[string]any{"note_id": note.ID}},
		{"log_execution", map[string]any{
			"account_id": aliceAcct, "symbol": "ZZZT", "side": "sell", "quantity": 1, "price": 1,
			"executed_at": "2026-03-02T15:00:00Z",
		}},
	} {
		text, isErr := callTool(t, bob, c.tool, c.args)
		require.True(t, isErr, "bob %s succeeded: %s", c.tool, text)
		require.Contains(t, text, "not found", c.tool)
	}

	// Alice's data is intact.
	detail := callOK(t, alice, "get_trade", map[string]any{"trade_id": fill.TradeID})
	require.NotContains(t, detail, "pwned")
	require.Contains(t, detail, `"status":"open"`)
	require.Contains(t, callOK(t, alice, "get_note", map[string]any{"note_id": note.ID}), "alice private")

	// Bob's MCP switch does not open Alice's: with hers off, her token is refused
	// while Bob's keeps working.
	setMCP(t, s, aliceJWT, false, false)
	_, err := tryConnectMCP(srv, "Bearer "+alicePAT)
	require.Error(t, err)
	callOK(t, bob, "list_trades", nil)
}
