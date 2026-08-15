package coach

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/ocr"
)

// ErrUnavailable means coach LLM is disabled or not configured.
var ErrUnavailable = errors.New("coach unavailable")

// ErrTimeout means the coach upstream did not respond in time.
var ErrTimeout = errors.New("coach timeout")

// DefaultTimeout for coach chat completions.
const DefaultTimeout = 60 * time.Second

const maxNotes = 5

// Note is one coaching bullet returned to the client.
type Note struct {
	ID       string `json:"id"`
	Tone     string `json:"tone"` // neg | warn | pos | tip
	Headline string `json:"headline"`
	Detail   string `json:"detail"`
	Priority int    `json:"priority"`
}

// Review is the LLM coaching result.
type Review struct {
	Notes []Note `json:"notes"`
	// NextAction is the single concrete thing to do before the next trade.
	// Required of the model so a review lands as a change in behaviour rather
	// than an essay; empty only when the model ignored the instruction.
	NextAction string `json:"next_action,omitempty"`
}

type chatRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	ResponseFormat *chatFmt      `json:"response_format,omitempty"`
	Temperature    float64       `json:"temperature"`
	Stream         bool          `json:"stream,omitempty"`
}

type chatFmt struct {
	Type       string      `json:"type"`
	JSONSchema *jsonSchema `json:"json_schema,omitempty"`
}

type jsonSchema struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

// schemaFormat asks for schema-constrained decoding. Small local models are
// far likelier to return usable JSON under a grammar than under prompt
// instructions alone, which is the whole reason the repair helpers below exist.
func schemaFormat() *chatFmt {
	note := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"tone":     map[string]any{"type": "string", "enum": []string{"neg", "warn", "pos", "tip"}},
			"headline": map[string]any{"type": "string"},
			"detail":   map[string]any{"type": "string"},
		},
		"required":             []string{"tone", "headline", "detail"},
		"additionalProperties": false,
	}
	return &chatFmt{
		Type: "json_schema",
		JSONSchema: &jsonSchema{
			Name:   "trade_review",
			Strict: true,
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"notes":       map[string]any{"type": "array", "items": note},
					"next_action": map[string]any{"type": "string"},
				},
				"required":             []string{"notes", "next_action"},
				"additionalProperties": false,
			},
		},
	}
}

func objectFormat() *chatFmt { return &chatFmt{Type: "json_object"} }

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatAPIResponse struct {
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type notesPayload struct {
	Notes []struct {
		Tone     string `json:"tone"`
		Headline string `json:"headline"`
		Detail   string `json:"detail"`
	} `json:"notes"`
	NextAction string `json:"next_action"`
}

func systemPrompt(cfg ocr.VisionConfig) string {
	if p := strings.TrimSpace(cfg.CustomPrompt); p != "" {
		return p
	}
	return DefaultCoachPrompt
}

func modelName(cfg ocr.VisionConfig) string {
	if strings.TrimSpace(cfg.Model) == "" {
		return "gpt-4o-mini"
	}
	return strings.TrimSpace(cfg.Model)
}

func timeout(cfg ocr.VisionConfig) time.Duration {
	if cfg.Timeout > 0 {
		return cfg.Timeout
	}
	return DefaultTimeout
}

func client(cfg ocr.VisionConfig) *http.Client {
	if cfg.HTTPClient != nil {
		return cfg.HTTPClient
	}
	return &http.Client{Timeout: timeout(cfg)}
}

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, ErrTimeout) {
		return true
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return true
	}
	return false
}

// errFormatRejected means the endpoint refused the response_format we asked
// for, not the request as a whole — the caller retries in a simpler mode.
var errFormatRejected = errors.New("response format rejected")

// errStreamUnsupported means the endpoint refused the request even in plain
// JSON mode, so the objection is to streaming itself; the caller falls back to
// a blocking call.
var errStreamUnsupported = errors.New("streaming unsupported")

// GenerateReview calls an OpenAI-compatible chat completions endpoint with trade context.
//
// It asks for schema-constrained decoding first and falls back to plain JSON
// mode when the endpoint rejects it: `json_schema` is well supported by
// OpenAI, LM Studio and recent Ollama, but the compat layers self-hosters put
// in front of local models are uneven, and a coach that used to work must not
// start erroring because of a format upgrade.
func GenerateReview(ctx context.Context, cfg ocr.VisionConfig, trade TradeContext) (Review, error) {
	if !cfg.Ready() {
		return Review{}, fmt.Errorf("%w: coach not configured", ErrUnavailable)
	}

	userMsg := FormatTradeContext(trade) + "\n\n" + responseFormatPrompt
	messages := []chatMessage{
		{Role: "system", Content: systemPrompt(cfg)},
		{Role: "user", Content: userMsg},
	}

	review, err := requestReview(ctx, cfg, messages, schemaFormat())
	if errors.Is(err, errFormatRejected) {
		review, err = requestReview(ctx, cfg, messages, objectFormat())
	}
	return review, err
}

// requestReview performs one chat completion and decodes it into a Review.
func requestReview(
	ctx context.Context,
	cfg ocr.VisionConfig,
	messages []chatMessage,
	format *chatFmt,
) (Review, error) {
	payload, err := json.Marshal(chatRequest{
		Model:          modelName(cfg),
		Messages:       messages,
		ResponseFormat: format,
		Temperature:    0.3,
	})
	if err != nil {
		return Review{}, err
	}

	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	url := base + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return Review{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cfg.APIKey))

	res, err := client(cfg).Do(req)
	if err != nil {
		if isTimeoutErr(err) {
			return Review{}, fmt.Errorf(
				"%w: coach API at %s did not respond within %s",
				ErrTimeout,
				base,
				timeout(cfg),
			)
		}
		return Review{}, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if err != nil {
		return Review{}, err
	}
	if res.StatusCode >= 300 {
		apiErr := fmt.Errorf("coach api %s: %s", res.Status, truncateRunes(string(raw), 300))
		if isSchemaRequest(format) && rejectsRequestShape(res.StatusCode) {
			return Review{}, fmt.Errorf("%w: %w", errFormatRejected, apiErr)
		}
		return Review{}, apiErr
	}

	var api chatAPIResponse
	if err := json.Unmarshal(raw, &api); err != nil {
		return Review{}, fmt.Errorf("coach decode: %w", err)
	}
	if api.Error != nil && api.Error.Message != "" {
		return Review{}, fmt.Errorf("coach api: %s", api.Error.Message)
	}
	if len(api.Choices) == 0 {
		return Review{}, fmt.Errorf("coach api: empty choices")
	}
	content, err := messageText(api.Choices[0].Message.Content)
	if err != nil {
		return Review{}, err
	}
	return parseReview(content)
}

// parseReview turns a raw model payload into a Review, repairing the common
// ways a model wraps or pads JSON. Both the blocking and streaming paths end
// here, so a streamed review is decoded exactly like a blocking one.
func parseReview(content string) (Review, error) {
	content = stripJSONFence(content)
	content = extractJSONObject(content)

	var parsed notesPayload
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return Review{}, fmt.Errorf("coach json: %w — got %q", err, truncateRunes(content, 120))
	}

	notes := make([]Note, 0, len(parsed.Notes))
	for i, n := range parsed.Notes {
		if i >= maxNotes {
			break
		}
		note, ok := toNote(n.Tone, n.Headline, n.Detail, i)
		if !ok {
			continue
		}
		notes = append(notes, note)
	}
	return Review{Notes: notes, NextAction: strings.TrimSpace(parsed.NextAction)}, nil
}

// toNote normalises one note. Reports false for a note with neither a headline
// nor a detail, which carries nothing worth showing.
func toNote(tone, headline, detail string, idx int) (Note, bool) {
	headline = strings.TrimSpace(headline)
	detail = strings.TrimSpace(detail)
	if headline == "" && detail == "" {
		return Note{}, false
	}
	if headline == "" {
		headline = "Coach note"
	}
	return Note{
		ID:       fmt.Sprintf("llm-%d", idx+1),
		Tone:     normalizeTone(tone),
		Headline: headline,
		Detail:   detail,
		Priority: idx + 1,
	}, true
}

func isSchemaRequest(f *chatFmt) bool {
	return f != nil && f.Type == "json_schema"
}

// rejectsRequestShape reports whether a status plausibly means "I do not
// understand this request body" rather than "your credentials or quota are
// the problem" — retrying the latter in a simpler format would just fail
// twice and double the user's wait.
func rejectsRequestShape(status int) bool {
	switch status {
	case http.StatusBadRequest,
		http.StatusNotFound,
		http.StatusMethodNotAllowed,
		http.StatusUnprocessableEntity,
		http.StatusNotImplemented:
		return true
	default:
		return false
	}
}

func normalizeTone(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "neg", "negative", "issue", "bad":
		return "neg"
	case "warn", "warning", "watch", "caution":
		return "warn"
	case "pos", "positive", "strength", "good":
		return "pos"
	default:
		return "tip"
	}
}

func stripJSONFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimPrefix(s, "```JSON")
		s = strings.TrimPrefix(s, "```")
		if i := strings.LastIndex(s, "```"); i >= 0 {
			s = s[:i]
		}
		s = strings.TrimSpace(s)
	}
	return s
}

func extractJSONObject(s string) string {
	s = strings.TrimSpace(s)
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return strings.TrimSpace(s[start : end+1])
	}
	return s
}

func messageText(raw json.RawMessage) (string, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return "", fmt.Errorf("coach api: empty message content")
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return strings.TrimSpace(asString), nil
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err == nil {
		var b strings.Builder
		for _, p := range parts {
			if strings.TrimSpace(p.Text) == "" {
				continue
			}
			if b.Len() > 0 {
				b.WriteByte('\n')
			}
			b.WriteString(p.Text)
		}
		out := strings.TrimSpace(b.String())
		if out == "" {
			return "", fmt.Errorf("coach api: empty message content")
		}
		return out, nil
	}
	return "", fmt.Errorf("coach api: unexpected message content shape")
}

func truncateRunes(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
