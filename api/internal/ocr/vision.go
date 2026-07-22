package ocr

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const visionConfidenceFloor = 0.45

// DefaultVisionTimeout is the HTTP client timeout for vision chat completions.
// Multimodal requests often need longer than a typical REST call.
const DefaultVisionTimeout = 90 * time.Second

// ErrTimeout means the vision upstream did not respond before the client deadline.
var ErrTimeout = errors.New("ocr vision timeout")

// VisionConfig configures an OpenAI-compatible vision endpoint for screenshot parse.
type VisionConfig struct {
	Enabled bool
	BaseURL string
	APIKey  string
	Model   string
	// CustomPrompt overrides the built-in vision system prompt when non-empty.
	CustomPrompt string
	// Timeout for the HTTP client; zero uses DefaultVisionTimeout.
	Timeout time.Duration
	// HTTPClient optional; defaults to a client with Timeout.
	HTTPClient *http.Client
}

func (c VisionConfig) Ready() bool {
	return c.Enabled && strings.TrimSpace(c.BaseURL) != "" && strings.TrimSpace(c.APIKey) != ""
}

func (c VisionConfig) model() string {
	if strings.TrimSpace(c.Model) == "" {
		return "gpt-4o-mini"
	}
	return strings.TrimSpace(c.Model)
}

func (c VisionConfig) systemPrompt() string {
	if p := strings.TrimSpace(c.CustomPrompt); p != "" {
		return p
	}
	return DefaultVisionPrompt
}

func (c VisionConfig) timeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return DefaultVisionTimeout
}

func (c VisionConfig) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: c.timeout()}
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

type visionRequest struct {
	Model          string             `json:"model"`
	Messages       []visionMessage    `json:"messages"`
	ResponseFormat *visionResponseFmt `json:"response_format,omitempty"`
	Temperature    float64            `json:"temperature"`
}

type visionResponseFmt struct {
	Type string `json:"type"`
}

type visionMessage struct {
	Role    string       `json:"role"`
	Content []visionPart `json:"content"`
}

type visionPart struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *visionImageURL `json:"image_url,omitempty"`
}

type visionImageURL struct {
	URL string `json:"url"`
}

type visionAPIResponse struct {
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type visionJSONPayload struct {
	Symbol         string `json:"symbol"`
	InstrumentType string `json:"instrument_type"`
	Side           string `json:"side"`
	Rows           []struct {
		Symbol      string  `json:"symbol"`
		Side        string  `json:"side"`
		Quantity    float64 `json:"quantity"`
		Price       float64 `json:"price"`
		Fees        float64 `json:"fees"`
		Commission  float64 `json:"commission"`
		ExecutedAt  string  `json:"executed_at"`
		OptionRight string  `json:"option_right"`
		Strike      float64 `json:"strike"`
		Expiry      string  `json:"expiry"`
	} `json:"rows"`
	Warnings []string `json:"warnings"`
}

// DefaultVisionPrompt is used when no custom prompt is configured.
const DefaultVisionPrompt = `You extract trading fills from a broker screenshot.
Return ONLY JSON with this shape:
{
  "symbol": "TICKER",
  "instrument_type": "stock|option|future|crypto|forex",
  "side": "long|short",
  "rows": [
    {
      "symbol": "TICKER",
      "side": "buy|sell",
      "quantity": 0,
      "price": 0,
      "fees": 0,
      "commission": 0,
      "executed_at": "RFC3339 or empty",
      "option_right": "call|put|",
      "strike": 0,
      "expiry": "YYYY-MM-DD or empty"
    }
  ],
  "warnings": ["optional notes"]
}
Rules:
- Works for any broker UI — do not assume a specific layout.
- Prefer fill/execution price over limit price.
- Map broker commission into fees when only one cost is shown; leave commission 0.
- Include every distinct fill visible — when multiple underlyings appear, emit a row per fill with that row's symbol.
- Set top-level "symbol" to the majority underlying; still keep every ticker on its rows.
- side long/short from the earliest opening fill of the majority symbol when unclear.
- If unsure, still return best-effort rows and add warnings.`

// ExtractTradeFromImage calls an OpenAI-compatible chat completions vision endpoint.
func ExtractTradeFromImage(ctx context.Context, cfg VisionConfig, image []byte, contentType string) (TradeExtract, error) {
	if !cfg.Ready() {
		return TradeExtract{}, fmt.Errorf("%w: vision not configured", ErrUnavailable)
	}
	if len(image) == 0 {
		return TradeExtract{}, fmt.Errorf("empty image")
	}
	ct := strings.TrimSpace(contentType)
	if ct == "" {
		ct = "image/png"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", ct, base64.StdEncoding.EncodeToString(image))

	body := visionRequest{
		Model: cfg.model(),
		Messages: []visionMessage{{
			Role: "user",
			Content: []visionPart{
				{Type: "text", Text: cfg.systemPrompt()},
				{Type: "image_url", ImageURL: &visionImageURL{URL: dataURL}},
			},
		}},
		ResponseFormat: &visionResponseFmt{Type: "json_object"},
		Temperature:    0,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return TradeExtract{}, err
	}

	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	url := base + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return TradeExtract{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cfg.APIKey))

	res, err := cfg.client().Do(req)
	if err != nil {
		if isTimeoutErr(err) {
			return TradeExtract{}, fmt.Errorf(
				"%w: vision API at %s did not respond within %s",
				ErrTimeout,
				base,
				cfg.timeout(),
			)
		}
		return TradeExtract{}, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return TradeExtract{}, err
	}
	if res.StatusCode >= 300 {
		return TradeExtract{}, fmt.Errorf("vision api %s: %s", res.Status, truncateRunes(string(raw), 300))
	}

	var api visionAPIResponse
	if err := json.Unmarshal(raw, &api); err != nil {
		return TradeExtract{}, fmt.Errorf("vision decode: %w", err)
	}
	if api.Error != nil && api.Error.Message != "" {
		return TradeExtract{}, fmt.Errorf("vision api: %s", api.Error.Message)
	}
	if len(api.Choices) == 0 {
		return TradeExtract{}, fmt.Errorf("vision api: empty choices")
	}
	content, err := visionMessageText(api.Choices[0].Message.Content)
	if err != nil {
		return TradeExtract{}, err
	}
	content = stripJSONFence(content)
	content = extractJSONObject(content)

	var parsed visionJSONPayload
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return TradeExtract{}, fmt.Errorf("vision json: %w — got %q", err, truncateRunes(content, 120))
	}

	out := TradeExtract{
		Symbol:         strings.ToUpper(strings.TrimSpace(parsed.Symbol)),
		InstrumentType: strings.ToLower(strings.TrimSpace(parsed.InstrumentType)),
		Side:           strings.ToLower(strings.TrimSpace(parsed.Side)),
		Rows:           make([]ExtractedFill, 0, len(parsed.Rows)),
		Warnings:       append([]string{}, parsed.Warnings...),
	}
	if out.InstrumentType == "" {
		out.InstrumentType = "stock"
	}
	if out.Side != "long" && out.Side != "short" {
		out.Side = ""
	}
	for _, r := range parsed.Rows {
		side := mapSideToBuySell(r.Side)
		if side == "" {
			side = strings.ToLower(strings.TrimSpace(r.Side))
		}
		if side != "buy" && side != "sell" {
			continue
		}
		if r.Quantity <= 0 || r.Price <= 0 {
			continue
		}
		fees := r.Fees
		if fees == 0 && r.Commission > 0 {
			fees = r.Commission
		}
		sym := strings.ToUpper(strings.TrimSpace(r.Symbol))
		if sym == "" {
			sym = out.Symbol
		}
		right := strings.ToLower(strings.TrimSpace(r.OptionRight))
		if right != "call" && right != "put" {
			right = ""
		}
		out.Rows = append(out.Rows, ExtractedFill{
			Symbol:      sym,
			Side:        side,
			Quantity:    r.Quantity,
			Price:       r.Price,
			Fees:        fees,
			Commission:  0,
			ExecutedAt:  strings.TrimSpace(r.ExecutedAt),
			OptionRight: right,
			Strike:      r.Strike,
			Expiry:      strings.TrimSpace(r.Expiry),
		})
	}
	if len(out.Rows) == 0 {
		out.Warnings = append(out.Warnings, "vision returned no usable fills — try a clearer screenshot or CSV import")
		out.Confidence = 0.2
		return out, nil
	}
	out.Warnings = append(out.Warnings, "vision extract — review fills before saving")
	out = finalizeExtract(out)
	if out.Side == "" && (parsed.Side == "long" || parsed.Side == "short") {
		out.Side = parsed.Side
	}
	if out.Confidence < visionConfidenceFloor {
		out.Confidence = visionConfidenceFloor + 0.2
	}
	return out, nil
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

// extractJSONObject pulls the outermost {...} object from mixed model output.
func extractJSONObject(s string) string {
	s = strings.TrimSpace(s)
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return strings.TrimSpace(s[start : end+1])
	}
	return s
}

func visionMessageText(raw json.RawMessage) (string, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return "", fmt.Errorf("vision api: empty message content")
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
			return "", fmt.Errorf("vision api: empty message content")
		}
		return out, nil
	}
	return "", fmt.Errorf("vision api: unexpected message content shape")
}

func truncateRunes(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
