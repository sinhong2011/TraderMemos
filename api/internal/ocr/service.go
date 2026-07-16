package ocr

import (
	"context"
	"fmt"
	"strings"
)

// Service runs OCR then structural parse.
type Service struct {
	provider Provider
}

func NewService(provider Provider) *Service {
	if provider == nil {
		return nil
	}
	return &Service{provider: provider}
}

func (s *Service) ProviderName() string {
	if s == nil || s.provider == nil {
		return ""
	}
	return s.provider.Name()
}

// ParseImage OCRs an image and extracts trade draft fields.
func (s *Service) ParseImage(ctx context.Context, image []byte, contentType string) (TradeExtract, error) {
	if s == nil || s.provider == nil {
		return TradeExtract{}, ErrUnavailable
	}
	ct := strings.TrimSpace(contentType)
	text, err := s.provider.ExtractText(ctx, image, ct)
	if err != nil {
		return TradeExtract{}, fmt.Errorf("ocr extract: %w", err)
	}
	return ParseTradeText(text), nil
}
