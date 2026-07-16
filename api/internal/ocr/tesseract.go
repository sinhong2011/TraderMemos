//go:build tesseract

package ocr

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/otiai10/gosseract/v2"
)

type tesseractProvider struct {
	lang string
}

func newTesseractProvider(lang string) (Provider, error) {
	// Smoke-check that the shared library + tessdata are usable.
	client := gosseract.NewClient()
	defer client.Close()
	if err := client.SetLanguage(lang); err != nil {
		return nil, fmt.Errorf("%w: set language: %v", ErrUnavailable, err)
	}
	return &tesseractProvider{lang: lang}, nil
}

func (p *tesseractProvider) Name() string { return "tesseract" }

func (p *tesseractProvider) ExtractText(ctx context.Context, image []byte, contentType string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(image) == 0 {
		return "", fmt.Errorf("empty image")
	}

	ext := extForContentType(contentType)
	tmp, err := os.CreateTemp("", "tm-ocr-*"+ext)
	if err != nil {
		return "", err
	}
	path := tmp.Name()
	defer os.Remove(path)

	if _, err := tmp.Write(image); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	client := gosseract.NewClient()
	defer client.Close()
	if err := client.SetLanguage(p.lang); err != nil {
		return "", err
	}
	// Sparse text mode helps screenshots with labels + values.
	// PSM 6 (SINGLE_BLOCK) matches the IBKR list layout better than AUTO.
	_ = client.SetPageSegMode(gosseract.PSM_SINGLE_BLOCK)
	if err := client.SetImage(path); err != nil {
		return "", err
	}
	text, err := client.Text()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(text), nil
}

func extForContentType(ct string) string {
	switch strings.ToLower(strings.TrimSpace(ct)) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	default:
		if ext := filepath.Ext(ct); ext != "" {
			return ext
		}
		return ".png"
	}
}
