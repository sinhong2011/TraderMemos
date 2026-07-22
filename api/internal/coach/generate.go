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
}

type chatRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	ResponseFormat *chatFmt      `json:"response_format,omitempty"`
	Temperature    float64       `json:"temperature"`
}

type chatFmt struct {
	Type string `json:"type"`
}

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

// GenerateReview calls an OpenAI-compatible chat completions endpoint with trade context.
func GenerateReview(ctx context.Context, cfg ocr.VisionConfig, trade TradeContext) (Review, error) {
	if !cfg.Ready() {
		return Review{}, fmt.Errorf("%w: coach not configured", ErrUnavailable)
	}

	userMsg := FormatTradeContext(trade) + "\n\n" + responseFormatPrompt
	body := chatRequest{
		Model: modelName(cfg),
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt(cfg)},
			{Role: "user", Content: userMsg},
		},
		ResponseFormat: &chatFmt{Type: "json_object"},
		Temperature:    0.3,
	}
	payload, err := json.Marshal(body)
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
		return Review{}, fmt.Errorf("coach api %s: %s", res.Status, truncateRunes(string(raw), 300))
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
		tone := normalizeTone(n.Tone)
		headline := strings.TrimSpace(n.Headline)
		detail := strings.TrimSpace(n.Detail)
		if headline == "" && detail == "" {
			continue
		}
		if headline == "" {
			headline = "Coach note"
		}
		notes = append(notes, Note{
			ID:       fmt.Sprintf("llm-%d", i+1),
			Tone:     tone,
			Headline: headline,
			Detail:   detail,
			Priority: i + 1,
		})
	}
	return Review{Notes: notes}, nil
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
