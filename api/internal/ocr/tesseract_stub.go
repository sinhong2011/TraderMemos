//go:build !tesseract

package ocr

import "fmt"

func newTesseractProvider(lang string) (Provider, error) {
	_ = lang
	return nil, fmt.Errorf("%w: rebuild API with -tags tesseract and Tesseract installed", ErrUnavailable)
}
