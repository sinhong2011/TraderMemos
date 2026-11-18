package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/tradermemos/api/internal/version"
)

const mcpInstructions = `TraderMemos is the user's self-hosted trading journal.

- Trades are derived from executions (fills). To record a trade, log its fills with log_execution (an opening buy and a closing sell for a long, the reverse for a short); the server groups fills into trades. Call list_accounts first for an account_id.
- Use list_trades / get_trade to read trades, get_analytics for performance reports, and list_notes / get_note for journal notes.
- Dates accept RFC3339 timestamps or YYYY-MM-DD (UTC).
- Write tools appear only when the user has enabled MCP write access in TraderMemos. Confirm with the user before deleting anything; deletions cannot be undone.`

// mcpDefaultLimit / mcpMaxLimit bound list results so one call cannot pour a
// whole journal into the model's context.
const (
	mcpDefaultLimit = 50
	mcpMaxLimit     = 500
)

func boolPtr(b bool) *bool { return &b }

// Annotation presets. Hints for the client's UI only — authorization is
// enforced server-side by the token and the write switch.
var (
	annRead = &mcp.ToolAnnotations{
		ReadOnlyHint: true, IdempotentHint: true,
		DestructiveHint: boolPtr(false), OpenWorldHint: boolPtr(false),
	}
	// Adds data, never overwrites or removes it.
	annAdditive = func(idempotent bool) *mcp.ToolAnnotations {
		return &mcp.ToolAnnotations{
			IdempotentHint:  idempotent,
			DestructiveHint: boolPtr(false), OpenWorldHint: boolPtr(false),
		}
	}
	// Overwrites or removes existing data.
	annDestructive = &mcp.ToolAnnotations{
		IdempotentHint:  true,
		DestructiveHint: boolPtr(true), OpenWorldHint: boolPtr(false),
	}
)

func withTitle(a *mcp.ToolAnnotations, title string) *mcp.ToolAnnotations {
	cp := *a
	cp.Title = title
	return &cp
}

// mcpTools binds tool handlers to one caller.
type mcpTools struct {
	s      *Server
	caller *mcpCaller
}

func (s *Server) newMCPServer(caller *mcpCaller, schemas *mcp.SchemaCache) *mcp.Server {
	srv := mcp.NewServer(mcpImplementation(), &mcp.ServerOptions{
		Instructions: mcpInstructions,
		SchemaCache:  schemas,
	})
	t := &mcpTools{s: s, caller: caller}

	mcp.AddTool(srv, &mcp.Tool{
		Name:        "get_connection_info",
		Description: "Report what this MCP connection may do: read-only or read-write access, and the TraderMemos server version.",
		Annotations: withTitle(annRead, "Connection info"),
	}, t.connectionInfo)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "list_accounts",
		Description: "List the user's trading accounts (id, name, broker, base currency). Account ids scope the other tools.",
		Annotations: withTitle(annRead, "List accounts"),
	}, t.listAccounts)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "list_trades",
		Description: "List trades, newest first, with optional filters. Returns a page (limit/offset) and the total match count.",
		Annotations: withTitle(annRead, "List trades"),
	}, t.listTrades)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "get_trade",
		Description: "Get one trade in full: executions, journal (notes, setup, risk, emotion, grades), tags and excursion data.",
		Annotations: withTitle(annRead, "Get trade"),
	}, t.getTrade)
	mcp.AddTool(srv, &mcp.Tool{
		Name: "get_analytics",
		Description: "Run a performance report over the user's trades. report is one of: " +
			strings.Join(mcpReportNames(), ", ") + ". breakdown also needs group_by.",
		Annotations: withTitle(annRead, "Get analytics"),
	}, t.getAnalytics)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "list_notes",
		Description: "List journal notes (free notes, daily logs, weekly reviews), newest first.",
		Annotations: withTitle(annRead, "List notes"),
	}, t.listNotes)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "get_note",
		Description: "Get one journal note by id.",
		Annotations: withTitle(annRead, "Get note"),
	}, t.getNote)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "list_tags",
		Description: "List the user's tags (ids for update_trade_journal's tag_ids).",
		Annotations: withTitle(annRead, "List tags"),
	}, t.listTags)
	mcp.AddTool(srv, &mcp.Tool{
		Name:        "list_setups",
		Description: "List the user's trading setups/playbooks (ids for update_trade_journal's setup_ids).",
		Annotations: withTitle(annRead, "List setups"),
	}, t.listSetups)

	// Write tools exist only when the owner allowed writes. Not listing them
	// keeps a read-only connection from even offering the model the option;
	// each handler re-checks anyway.
	if caller.allowWrites {
		mcp.AddTool(srv, &mcp.Tool{
			Name: "log_execution",
			Description: "Record one fill (buy or sell). The server groups fills into trades and returns the trade_id. " +
				"Logging the same fill twice is a no-op (deduplicated).",
			Annotations: withTitle(annAdditive(true), "Log execution"),
		}, t.logExecution)
		mcp.AddTool(srv, &mcp.Tool{
			Name: "update_trade_journal",
			Description: "Update a trade's journal. Only the fields you pass change; notes, setup_ids and tag_ids " +
				"replace the current value rather than appending.",
			Annotations: withTitle(annDestructive, "Update trade journal"),
		}, t.updateTradeJournal)
		mcp.AddTool(srv, &mcp.Tool{
			Name: "delete_trade",
			Description: "Permanently delete a trade together with its executions and attachments. Cannot be undone; " +
				"confirm with the user first.",
			Annotations: withTitle(annDestructive, "Delete trade"),
		}, t.deleteTrade)
		mcp.AddTool(srv, &mcp.Tool{
			Name:        "create_note",
			Description: "Create a journal note.",
			Annotations: withTitle(annAdditive(false), "Create note"),
		}, t.createNote)
		mcp.AddTool(srv, &mcp.Tool{
			Name:        "update_note",
			Description: "Update a journal note. Only the fields you pass change.",
			Annotations: withTitle(annDestructive, "Update note"),
		}, t.updateNote)
		mcp.AddTool(srv, &mcp.Tool{
			Name:        "delete_note",
			Description: "Permanently delete a journal note. Cannot be undone; confirm with the user first.",
			Annotations: withTitle(annDestructive, "Delete note"),
		}, t.deleteNote)
	}
	return srv
}

// ---------- results ----------

func textResult(v any) (*mcp.CallToolResult, any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, nil, fmt.Errorf("encode result: %w", err)
	}
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(b)}}}, nil, nil
}

func rawResult(b []byte) (*mcp.CallToolResult, any, error) {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(b)}}}, nil, nil
}

// toolError is a tool-level failure the model can read and act on (bad
// argument, not found, write access off) — as opposed to a protocol error.
func toolError(format string, args ...any) (*mcp.CallToolResult, any, error) {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf(format, args...)}},
	}, nil, nil
}

// apiError turns a non-2xx REST answer into a tool error carrying the API's
// own code and message. 5xx bodies are not echoed.
func apiError(status int, body []byte) (*mcp.CallToolResult, any, error) {
	if status >= http.StatusInternalServerError {
		return toolError("TraderMemos server error (HTTP %d); try again later", status)
	}
	var env errEnvelope
	if err := json.Unmarshal(body, &env); err == nil && env.Error.Message != "" {
		return toolError("TraderMemos API error (HTTP %d, %s): %s", status, env.Error.Code, env.Error.Message)
	}
	return toolError("TraderMemos API error (HTTP %d)", status)
}

func ok2xx(status int) bool { return status >= 200 && status < 300 }

// do replays a REST call and returns its body as the tool result.
func (t *mcpTools) do(ctx context.Context, method, path string, q url.Values, body any) (*mcp.CallToolResult, any, error) {
	status, b, err := t.s.mcpCall(ctx, t.caller, method, path, q, body)
	if err != nil {
		return nil, nil, err
	}
	if !ok2xx(status) {
		return apiError(status, b)
	}
	if status == http.StatusNoContent || len(b) == 0 {
		return textResult(map[string]bool{"ok": true})
	}
	return rawResult(b)
}

func (t *mcpTools) requireWrites() (*mcp.CallToolResult, any, error, bool) {
	if t.caller.allowWrites {
		return nil, nil, nil, true
	}
	r, o, e := toolError("write access is turned off for MCP; the user can enable it in TraderMemos under Settings → API → MCP for AI assistants")
	return r, o, e, false
}

// ---------- validation helpers ----------

var mcpIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

func validID(name, id string) error {
	if !mcpIDPattern.MatchString(strings.TrimSpace(id)) {
		return fmt.Errorf("%s must be an id as returned by the list tools", name)
	}
	return nil
}

var ymd = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// normalizeBound accepts RFC3339 or YYYY-MM-DD. A bare date becomes the start
// (from) or end (to) of that UTC day.
func normalizeBound(v string, end bool) string {
	v = strings.TrimSpace(v)
	if ymd.MatchString(v) {
		if end {
			return v + "T23:59:59Z"
		}
		return v + "T00:00:00Z"
	}
	return v
}

func clampLimit(limit, offset int) (int, int, error) {
	if limit < 0 || offset < 0 {
		return 0, 0, fmt.Errorf("limit and offset must be >= 0")
	}
	if limit == 0 {
		limit = mcpDefaultLimit
	}
	if limit > mcpMaxLimit {
		limit = mcpMaxLimit
	}
	return limit, offset, nil
}

// ---------- read tools ----------

type emptyArgs struct{}

func (t *mcpTools) connectionInfo(ctx context.Context, _ *mcp.CallToolRequest, _ emptyArgs) (*mcp.CallToolResult, any, error) {
	access := "read_only"
	if t.caller.allowWrites {
		access = "read_write"
	}
	return textResult(map[string]string{
		"access":         access,
		"server":         "TraderMemos",
		"server_version": version.Version,
		"change_access":  "The account owner controls MCP access in TraderMemos under Settings → API → MCP for AI assistants.",
	})
}

func (t *mcpTools) listAccounts(ctx context.Context, _ *mcp.CallToolRequest, _ emptyArgs) (*mcp.CallToolResult, any, error) {
	return t.do(ctx, http.MethodGet, "/accounts", nil, nil)
}

type tradeFilterArgs struct {
	AccountIDs []string `json:"account_ids,omitempty" jsonschema:"restrict to these account ids (default: all accounts)"`
	From       string   `json:"from,omitempty" jsonschema:"lower date bound, RFC3339 or YYYY-MM-DD (UTC)"`
	To         string   `json:"to,omitempty" jsonschema:"upper date bound, RFC3339 or YYYY-MM-DD (UTC, inclusive)"`
	Symbol     string   `json:"symbol,omitempty" jsonschema:"ticker symbol, e.g. AAPL"`
	Status     string   `json:"status,omitempty" jsonschema:"open or closed"`
	Side       string   `json:"side,omitempty" jsonschema:"long or short"`
	Duration   string   `json:"duration,omitempty" jsonschema:"scalp, day or swing"`
	DateBasis  string   `json:"date_basis,omitempty" jsonschema:"which date from/to match: close (default) or open"`
	Timezone   string   `json:"timezone,omitempty" jsonschema:"IANA timezone for day/hour bucketing, e.g. America/New_York"`
}

func (f tradeFilterArgs) query() url.Values {
	q := url.Values{}
	for _, id := range f.AccountIDs {
		if id = strings.TrimSpace(id); id != "" {
			q.Add("account_id", id)
		}
	}
	set := func(k, v string) {
		if v = strings.TrimSpace(v); v != "" {
			q.Set(k, v)
		}
	}
	set("from", normalizeBound(f.From, false))
	set("to", normalizeBound(f.To, true))
	set("symbol", f.Symbol)
	set("status", f.Status)
	set("side", f.Side)
	set("duration", f.Duration)
	set("date_basis", f.DateBasis)
	set("tz", f.Timezone)
	return q
}

type listTradesArgs struct {
	tradeFilterArgs
	Limit  int `json:"limit,omitempty" jsonschema:"page size, default 50, max 500"`
	Offset int `json:"offset,omitempty" jsonschema:"number of trades to skip"`
}

type pageResult struct {
	Total  int               `json:"total"`
	Offset int               `json:"offset"`
	Limit  int               `json:"limit"`
	Items  []json.RawMessage `json:"items"`
}

func paginate(b []byte, limit, offset int) (pageResult, error) {
	var all []json.RawMessage
	if err := json.Unmarshal(b, &all); err != nil {
		return pageResult{}, fmt.Errorf("decode list: %w", err)
	}
	start := min(offset, len(all))
	end := min(start+limit, len(all))
	return pageResult{Total: len(all), Offset: offset, Limit: limit, Items: all[start:end]}, nil
}

func (t *mcpTools) listTrades(ctx context.Context, _ *mcp.CallToolRequest, in listTradesArgs) (*mcp.CallToolResult, any, error) {
	limit, offset, err := clampLimit(in.Limit, in.Offset)
	if err != nil {
		return toolError("%v", err)
	}
	status, b, err := t.s.mcpCall(ctx, t.caller, http.MethodGet, "/trades", in.query(), nil)
	if err != nil {
		return nil, nil, err
	}
	if !ok2xx(status) {
		return apiError(status, b)
	}
	page, err := paginate(b, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	return textResult(page)
}

type tradeIDArgs struct {
	TradeID string `json:"trade_id" jsonschema:"trade id from list_trades"`
}

func (t *mcpTools) getTrade(ctx context.Context, _ *mcp.CallToolRequest, in tradeIDArgs) (*mcp.CallToolResult, any, error) {
	if err := validID("trade_id", in.TradeID); err != nil {
		return toolError("%v", err)
	}
	return t.do(ctx, http.MethodGet, "/trades/"+pathID(in.TradeID), nil, nil)
}

// mcpReports maps get_analytics report names to REST analytics routes.
var mcpReports = map[string]string{
	"summary":         "/analytics/summary",
	"r_summary":       "/analytics/r-summary",
	"daily":           "/analytics/daily",
	"equity_curve":    "/analytics/equity-curve",
	"breakdown":       "/analytics/breakdown",
	"behavior":        "/analytics/behavior",
	"compliance":      "/analytics/compliance",
	"execution_score": "/analytics/execution-score",
	"edge_score":      "/analytics/edge-score",
	"setup_scorecard": "/analytics/setup-scorecard",
	"mistake_tax":     "/analytics/mistake-tax",
}

func mcpReportNames() []string {
	// Fixed order for a stable tool description.
	return []string{
		"summary", "r_summary", "daily", "equity_curve", "breakdown", "behavior",
		"compliance", "execution_score", "edge_score", "setup_scorecard", "mistake_tax",
	}
}

type analyticsArgs struct {
	Report  string `json:"report" jsonschema:"summary, r_summary, daily, equity_curve, breakdown, behavior, compliance, execution_score, edge_score, setup_scorecard or mistake_tax"`
	GroupBy string `json:"group_by,omitempty" jsonschema:"breakdown dimension: symbol, setup, day_of_week, hour_of_day, session, tag, mistake or trade_quality"`
	tradeFilterArgs
}

func (t *mcpTools) getAnalytics(ctx context.Context, _ *mcp.CallToolRequest, in analyticsArgs) (*mcp.CallToolResult, any, error) {
	path, ok := mcpReports[strings.TrimSpace(in.Report)]
	if !ok {
		return toolError("unknown report %q; use one of: %s", in.Report, strings.Join(mcpReportNames(), ", "))
	}
	q := in.query()
	if in.Report == "breakdown" {
		if strings.TrimSpace(in.GroupBy) == "" {
			return toolError("breakdown needs group_by (symbol, setup, day_of_week, hour_of_day, session, tag, mistake or trade_quality)")
		}
		q.Set("by", strings.TrimSpace(in.GroupBy))
	}
	return t.do(ctx, http.MethodGet, path, q, nil)
}

type listNotesArgs struct {
	From   string `json:"from,omitempty" jsonschema:"earliest occurred_at date, YYYY-MM-DD"`
	To     string `json:"to,omitempty" jsonschema:"latest occurred_at date, YYYY-MM-DD"`
	Type   string `json:"type,omitempty" jsonschema:"only notes of this type: note, daily_log or weekly_review"`
	Limit  int    `json:"limit,omitempty" jsonschema:"page size, default 50, max 500"`
	Offset int    `json:"offset,omitempty" jsonschema:"number of notes to skip"`
}

func (t *mcpTools) listNotes(ctx context.Context, _ *mcp.CallToolRequest, in listNotesArgs) (*mcp.CallToolResult, any, error) {
	limit, offset, err := clampLimit(in.Limit, in.Offset)
	if err != nil {
		return toolError("%v", err)
	}
	q := url.Values{}
	if v := strings.TrimSpace(in.From); v != "" {
		q.Set("from", v)
	}
	if v := strings.TrimSpace(in.To); v != "" {
		// occurred_at is compared as text; a bare date must still include
		// notes stamped later that day.
		if ymd.MatchString(v) {
			v += "￿"
		}
		q.Set("to", v)
	}
	status, b, err := t.s.mcpCall(ctx, t.caller, http.MethodGet, "/notes", q, nil)
	if err != nil {
		return nil, nil, err
	}
	if !ok2xx(status) {
		return apiError(status, b)
	}
	if typ := strings.TrimSpace(in.Type); typ != "" {
		if _, ok := normalizeNoteType(typ); !ok {
			return toolError("type must be note, daily_log or weekly_review")
		}
		var notes []noteDTO
		if err := json.Unmarshal(b, &notes); err != nil {
			return nil, nil, fmt.Errorf("decode notes: %w", err)
		}
		kept := notes[:0]
		for _, n := range notes {
			if n.Type == typ {
				kept = append(kept, n)
			}
		}
		if b, err = json.Marshal(kept); err != nil {
			return nil, nil, err
		}
	}
	page, err := paginate(b, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	return textResult(page)
}

type noteIDArgs struct {
	NoteID string `json:"note_id" jsonschema:"note id from list_notes"`
}

func (t *mcpTools) getNote(ctx context.Context, _ *mcp.CallToolRequest, in noteIDArgs) (*mcp.CallToolResult, any, error) {
	if err := validID("note_id", in.NoteID); err != nil {
		return toolError("%v", err)
	}
	return t.do(ctx, http.MethodGet, "/notes/"+pathID(in.NoteID), nil, nil)
}

func (t *mcpTools) listTags(ctx context.Context, _ *mcp.CallToolRequest, _ emptyArgs) (*mcp.CallToolResult, any, error) {
	return t.do(ctx, http.MethodGet, "/tags", nil, nil)
}

func (t *mcpTools) listSetups(ctx context.Context, _ *mcp.CallToolRequest, _ emptyArgs) (*mcp.CallToolResult, any, error) {
	return t.do(ctx, http.MethodGet, "/setups", nil, nil)
}

// ---------- write tools ----------

type logExecutionArgs struct {
	AccountID      string            `json:"account_id" jsonschema:"account id from list_accounts"`
	Symbol         string            `json:"symbol" jsonschema:"ticker symbol (for options, the underlying)"`
	Side           string            `json:"side" jsonschema:"buy or sell"`
	Quantity       float64           `json:"quantity" jsonschema:"shares/contracts, > 0"`
	Price          float64           `json:"price" jsonschema:"fill price per unit"`
	ExecutedAt     string            `json:"executed_at" jsonschema:"fill time, RFC3339 (e.g. 2026-03-02T14:31:00Z)"`
	InstrumentType string            `json:"instrument_type,omitempty" jsonschema:"stock (default), option, future, forex or crypto"`
	Fees           float64           `json:"fees,omitempty" jsonschema:"exchange/regulatory fees"`
	Commission     float64           `json:"commission,omitempty" jsonschema:"broker commission"`
	Multiplier     float64           `json:"multiplier,omitempty" jsonschema:"contract multiplier; omit to use the instrument default"`
	Details        map[string]string `json:"details,omitempty" jsonschema:"instrument details, e.g. option right/strike/expiry"`
}

func (t *mcpTools) logExecution(ctx context.Context, _ *mcp.CallToolRequest, in logExecutionArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	if err := validID("account_id", in.AccountID); err != nil {
		return toolError("%v", err)
	}
	body := map[string]any{
		"account_id": in.AccountID, "symbol": strings.ToUpper(strings.TrimSpace(in.Symbol)),
		"side": strings.ToLower(strings.TrimSpace(in.Side)), "quantity": in.Quantity,
		"price": in.Price, "executed_at": strings.TrimSpace(in.ExecutedAt),
		"instrument_type": in.InstrumentType, "fees": in.Fees, "commission": in.Commission,
		"multiplier": in.Multiplier, "details": in.Details,
	}
	return t.do(ctx, http.MethodPost, "/executions", nil, body)
}

type updateTradeJournalArgs struct {
	TradeID        string   `json:"trade_id" jsonschema:"trade id from list_trades"`
	Notes          *string  `json:"notes,omitempty" jsonschema:"journal notes (replaces existing notes)"`
	SetupIDs       []string `json:"setup_ids,omitempty" jsonschema:"setup ids from list_setups; the first is the primary setup; [] clears"`
	TagIDs         []string `json:"tag_ids,omitempty" jsonschema:"tag ids from list_tags; replaces the trade's tags; [] clears"`
	InitialRisk    *float64 `json:"initial_risk,omitempty" jsonschema:"planned risk in account currency (1R)"`
	StopPrice      *float64 `json:"stop_price,omitempty" jsonschema:"planned stop price"`
	TargetPrice    *float64 `json:"target_price,omitempty" jsonschema:"planned target price"`
	EmotionalState *string  `json:"emotional_state,omitempty" jsonschema:"free-text emotional state"`
	Confidence     *int64   `json:"confidence,omitempty" jsonschema:"confidence 1-5; 0 clears"`
	TradeQuality   *int64   `json:"trade_quality,omitempty" jsonschema:"execution grade 1-5; 0 clears"`
}

func (t *mcpTools) updateTradeJournal(ctx context.Context, _ *mcp.CallToolRequest, in updateTradeJournalArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	if err := validID("trade_id", in.TradeID); err != nil {
		return toolError("%v", err)
	}
	for _, g := range []*int64{in.Confidence, in.TradeQuality} {
		if g != nil && (*g < 0 || *g > 5) {
			return toolError("confidence and trade_quality must be between 0 and 5")
		}
	}
	body := patchTradeReq{
		Notes: in.Notes, InitialRisk: in.InitialRisk, StopPrice: in.StopPrice,
		TargetPrice: in.TargetPrice, EmotionalState: in.EmotionalState,
		Confidence: in.Confidence, TradeQuality: in.TradeQuality,
		SetupIDs: in.SetupIDs, TagIDs: in.TagIDs,
	}
	return t.do(ctx, http.MethodPatch, "/trades/"+pathID(in.TradeID), nil, body)
}

func (t *mcpTools) deleteTrade(ctx context.Context, _ *mcp.CallToolRequest, in tradeIDArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	if err := validID("trade_id", in.TradeID); err != nil {
		return toolError("%v", err)
	}
	return t.do(ctx, http.MethodDelete, "/trades/"+pathID(in.TradeID), nil, nil)
}

type noteSymbolArgs struct {
	Symbol string `json:"symbol" jsonschema:"ticker symbol"`
	Body   string `json:"body,omitempty" jsonschema:"notes on this symbol"`
}

type createNoteArgs struct {
	Body       string           `json:"body" jsonschema:"note text (Markdown)"`
	OccurredAt string           `json:"occurred_at,omitempty" jsonschema:"date the note is about, YYYY-MM-DD (default: today, UTC)"`
	Title      string           `json:"title,omitempty" jsonschema:"title (defaults by type)"`
	Type       string           `json:"type,omitempty" jsonschema:"note (default), daily_log or weekly_review"`
	Symbols    []noteSymbolArgs `json:"symbols,omitempty" jsonschema:"per-symbol notes; daily_log only"`
}

func toNoteSymbols(in []noteSymbolArgs) []noteSymbolDTO {
	out := make([]noteSymbolDTO, 0, len(in))
	for _, s := range in {
		out = append(out, noteSymbolDTO(s))
	}
	return out
}

func (t *mcpTools) createNote(ctx context.Context, _ *mcp.CallToolRequest, in createNoteArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	occurred := strings.TrimSpace(in.OccurredAt)
	if occurred == "" {
		occurred = todayUTC()
	}
	return t.do(ctx, http.MethodPost, "/notes", nil, noteBody{
		Type: in.Type, OccurredAt: occurred, Title: in.Title, Body: in.Body,
		Symbols: toNoteSymbols(in.Symbols),
	})
}

type updateNoteArgs struct {
	NoteID     string            `json:"note_id" jsonschema:"note id from list_notes"`
	Body       *string           `json:"body,omitempty" jsonschema:"new note text (replaces the body)"`
	Title      *string           `json:"title,omitempty" jsonschema:"new title"`
	OccurredAt *string           `json:"occurred_at,omitempty" jsonschema:"new date, YYYY-MM-DD"`
	Type       *string           `json:"type,omitempty" jsonschema:"note, daily_log or weekly_review"`
	Symbols    *[]noteSymbolArgs `json:"symbols,omitempty" jsonschema:"replaces per-symbol notes; daily_log only"`
}

func (t *mcpTools) updateNote(ctx context.Context, _ *mcp.CallToolRequest, in updateNoteArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	if err := validID("note_id", in.NoteID); err != nil {
		return toolError("%v", err)
	}
	// PATCH /notes/:id takes the whole note; merge over the current one so a
	// partial update keeps the fields the model did not mention.
	path := "/notes/" + pathID(in.NoteID)
	status, b, err := t.s.mcpCall(ctx, t.caller, http.MethodGet, path, nil, nil)
	if err != nil {
		return nil, nil, err
	}
	if !ok2xx(status) {
		return apiError(status, b)
	}
	var cur noteDTO
	if err := json.Unmarshal(b, &cur); err != nil {
		return nil, nil, fmt.Errorf("decode note: %w", err)
	}
	next := noteBody{Type: cur.Type, OccurredAt: cur.OccurredAt, Title: cur.Title, Body: cur.Body, Symbols: cur.Symbols}
	if in.Body != nil {
		next.Body = *in.Body
	}
	if in.Title != nil {
		next.Title = *in.Title
	}
	if in.OccurredAt != nil {
		next.OccurredAt = *in.OccurredAt
	}
	if in.Type != nil {
		next.Type = *in.Type
	}
	if in.Symbols != nil {
		next.Symbols = toNoteSymbols(*in.Symbols)
	}
	return t.do(ctx, http.MethodPatch, path, nil, next)
}

func (t *mcpTools) deleteNote(ctx context.Context, _ *mcp.CallToolRequest, in noteIDArgs) (*mcp.CallToolResult, any, error) {
	if r, o, e, ok := t.requireWrites(); !ok {
		return r, o, e
	}
	if err := validID("note_id", in.NoteID); err != nil {
		return toolError("%v", err)
	}
	return t.do(ctx, http.MethodDelete, "/notes/"+pathID(in.NoteID), nil, nil)
}

func todayUTC() string { return time.Now().UTC().Format(time.DateOnly) }
