package ocr

import (
	"context"
	"errors"
	"strings"
)

// ErrUnavailable means screenshot parse is disabled or vision is not configured.
var ErrUnavailable = errors.New("ocr unavailable")

// ConfigLoader returns DB/UI overlay settings when present.
// ok=false means no stored row — keep env defaults only.
type ConfigLoader func(ctx context.Context) (overlay VisionConfig, ok bool, err error)

// Service extracts trade drafts from screenshots via LLM vision.
type Service struct {
	defaults VisionConfig
	load     ConfigLoader
}

// NewService builds a vision OCR service. defaults come from env; load may overlay DB settings.
func NewService(defaults VisionConfig, load ConfigLoader) *Service {
	return &Service{defaults: defaults, load: load}
}

// MergeVisionConfig overlays stored settings onto env defaults.
// Enabled is taken from the overlay. Empty overlay strings keep the base value.
func MergeVisionConfig(base, overlay VisionConfig) VisionConfig {
	out := base
	out.Enabled = overlay.Enabled
	if strings.TrimSpace(overlay.BaseURL) != "" {
		out.BaseURL = strings.TrimSpace(overlay.BaseURL)
	}
	if strings.TrimSpace(overlay.Model) != "" {
		out.Model = strings.TrimSpace(overlay.Model)
	}
	if strings.TrimSpace(overlay.APIKey) != "" {
		out.APIKey = strings.TrimSpace(overlay.APIKey)
	}
	// Empty custom prompt means use the built-in default at extract time.
	out.CustomPrompt = strings.TrimSpace(overlay.CustomPrompt)
	if overlay.HTTPClient != nil {
		out.HTTPClient = overlay.HTTPClient
	}
	return out
}

// Effective resolves env defaults + optional DB overlay for the current request.
func (s *Service) Effective(ctx context.Context) VisionConfig {
	if s == nil {
		return VisionConfig{}
	}
	cfg := s.defaults
	if s.load == nil {
		return cfg
	}
	overlay, ok, err := s.load(ctx)
	if err != nil || !ok {
		return cfg
	}
	return MergeVisionConfig(cfg, overlay)
}

// VisionEnabled reports whether the effective config can call a vision API.
func (s *Service) VisionEnabled() bool {
	if s == nil {
		return false
	}
	return s.Effective(context.Background()).Ready()
}

// ParseImage sends the screenshot to the configured vision model and returns a trade draft.
func (s *Service) ParseImage(ctx context.Context, image []byte, contentType string) (TradeExtract, error) {
	if s == nil {
		return TradeExtract{}, ErrUnavailable
	}
	cfg := s.Effective(ctx)
	if !cfg.Ready() {
		return TradeExtract{}, ErrUnavailable
	}
	return ExtractTradeFromImage(ctx, cfg, image, contentType)
}

// MaskAPIKeyHint returns a short hint like "…abcd" for UI display.
func MaskAPIKeyHint(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return "…"
	}
	return "…" + key[len(key)-4:]
}
