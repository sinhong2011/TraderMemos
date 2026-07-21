package api

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/ocr"
)

func (s *Server) ocrRoutes(g *echo.Group) {
	g.POST("/ocr/parse", s.handleOCRParse)
}

func (s *Server) handleOCRParse(c echo.Context) error {
	if s.deps.OCR == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "ocr not configured", nil)
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	maxBytes := s.deps.OCRMaxBytes
	if maxBytes <= 0 {
		maxBytes = s.deps.AttachMaxBytes
	}
	if maxBytes > 0 && fh.Size > maxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "image exceeds size limit", nil)
	}
	ct := fh.Header.Get("Content-Type")
	if !allowedImageTypes[ct] {
		if guessed := contentTypeFromName(fh.Filename); guessed != "" {
			ct = guessed
		}
	}
	if !allowedImageTypes[ct] {
		return Fail(http.StatusBadRequest, "bad_request", "only png/jpeg/webp images are allowed", nil)
	}
	src, err := fh.Open()
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not read file", nil)
	}
	defer src.Close()

	data, err := io.ReadAll(io.LimitReader(src, maxBytes+1))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not read file", nil)
	}
	if maxBytes > 0 && int64(len(data)) > maxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "image exceeds size limit", nil)
	}

	out, err := s.deps.OCR.ParseImage(c.Request().Context(), data, ct)
	if err != nil {
		if errors.Is(err, ocr.ErrUnavailable) {
			return Fail(http.StatusServiceUnavailable, "unavailable", "ocr not available", nil)
		}
		if errors.Is(err, ocr.ErrTimeout) {
			s.logger.Warn("ocr parse timed out", "err", err)
			return Fail(
				http.StatusGatewayTimeout,
				"ocr_timeout",
				"Vision API timed out — check the endpoint is up, or try a smaller screenshot",
				nil,
			)
		}
		s.logger.Warn("ocr parse failed", "err", err)
		msg := strings.TrimSpace(err.Error())
		if msg == "" {
			msg = "could not extract fills from image"
		}
		return Fail(http.StatusBadGateway, "ocr_failed", msg, nil)
	}
	if out.Rows == nil {
		out.Rows = []ocr.ExtractedFill{}
	}
	if out.Warnings == nil {
		out.Warnings = []string{}
	}
	return c.JSON(http.StatusOK, out)
}

func contentTypeFromName(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".png"):
		return "image/png"
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	default:
		return ""
	}
}
