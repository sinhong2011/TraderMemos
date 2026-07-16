package ocr

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// ErrUnavailable means OCR is disabled or the engine is not compiled in.
var ErrUnavailable = errors.New("ocr unavailable")

// Provider extracts plain text from an image.
type Provider interface {
	Name() string
	ExtractText(ctx context.Context, image []byte, contentType string) (string, error)
}

// NewProvider constructs an OCR provider by name.
// Supported: "tesseract" (default). Requires build tag `tesseract` + Tesseract libs.
func NewProvider(name, lang string) (Provider, error) {
	if lang == "" {
		lang = "eng"
	}
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "", "tesseract":
		return newTesseractProvider(lang)
	default:
		return nil, fmt.Errorf("unknown ocr provider %q", name)
	}
}
