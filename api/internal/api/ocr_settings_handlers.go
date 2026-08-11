package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/store"
)

type ocrSettingsDTO struct {
	Enabled       bool   `json:"enabled"`
	BaseURL       string `json:"base_url"`
	Model         string `json:"model"`
	CustomPrompt  string `json:"custom_prompt"`
	DefaultPrompt string `json:"default_prompt"`
	APIKeySet     bool   `json:"api_key_set"`
	APIKeyHint    string `json:"api_key_hint,omitempty"`
}

type ocrSettingsPutDTO struct {
	Enabled      bool   `json:"enabled"`
	BaseURL      string `json:"base_url"`
	Model        string `json:"model"`
	CustomPrompt string `json:"custom_prompt"`
	// APIKey optional — empty keeps the existing key.
	APIKey *string `json:"api_key"`
}

type ocrTestResultDTO struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type ocrTestRequestDTO struct {
	// Optional overrides so the UI can test before saving.
	BaseURL string  `json:"base_url"`
	Model   string  `json:"model"`
	APIKey  *string `json:"api_key"`
}

type ocrModelsRequestDTO struct {
	// Optional overrides so the UI can list models before saving.
	BaseURL string  `json:"base_url"`
	APIKey  *string `json:"api_key"`
}

type ocrModelsResultDTO struct {
	Models []string `json:"models"`
	Error  string   `json:"error,omitempty"`
}

func (s *Server) handleGetOcrSettings(c *echo.Context) error {
	cfg := s.effectiveVisionConfig(c.Request().Context())
	return c.JSON(http.StatusOK, toOcrSettingsDTO(cfg))
}

func (s *Server) handlePutOcrSettings(c *echo.Context) error {
	var in ocrSettingsPutDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	in.BaseURL = strings.TrimSpace(in.BaseURL)
	in.Model = strings.TrimSpace(in.Model)
	in.CustomPrompt = strings.TrimSpace(in.CustomPrompt)
	if in.BaseURL == "" {
		return Fail(http.StatusBadRequest, "bad_request", "base_url is required", nil)
	}
	if !strings.HasPrefix(in.BaseURL, "http://") && !strings.HasPrefix(in.BaseURL, "https://") {
		return Fail(http.StatusBadRequest, "bad_request", "base_url must be http(s)", nil)
	}
	if in.Model == "" {
		in.Model = "gpt-4o-mini"
	}

	existingKey := ""
	if row, err := s.deps.Store.GetOcrSettings(c.Request().Context()); err == nil {
		existingKey = row.ApiKey
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load ocr settings", nil)
	} else if s.deps.OCR != nil {
		existingKey = s.deps.OCR.Effective(c.Request().Context()).APIKey
	}

	apiKey := existingKey
	if in.APIKey != nil {
		if trimmed := strings.TrimSpace(*in.APIKey); trimmed != "" {
			apiKey = trimmed
		}
	}

	enabled := int64(0)
	if in.Enabled {
		enabled = 1
	}
	_, err := s.deps.Store.UpsertOcrSettings(c.Request().Context(), store.UpsertOcrSettingsParams{
		Enabled:      enabled,
		BaseUrl:      in.BaseURL,
		ApiKey:       apiKey,
		Model:        in.Model,
		CustomPrompt: in.CustomPrompt,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save ocr settings", nil)
	}

	cfg := s.effectiveVisionConfig(c.Request().Context())
	return c.JSON(http.StatusOK, toOcrSettingsDTO(cfg))
}

func (s *Server) handleTestOcrSettings(c *echo.Context) error {
	var in ocrTestRequestDTO
	_ = c.Bind(&in)
	if trimmed := strings.TrimSpace(in.BaseURL); trimmed != "" {
		if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return Fail(http.StatusBadRequest, "bad_request", "base_url must be http(s)", nil)
		}
	}

	cfg, err := s.ocrConfigWithOverrides(c.Request().Context(), in.BaseURL, in.Model, in.APIKey)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load ocr settings", nil)
	}
	if !cfg.AuthReady() {
		return c.JSON(http.StatusOK, ocrTestResultDTO{
			OK:    false,
			Error: "set base URL and API key to test connection",
		})
	}
	if err := ocr.TestVisionConnection(c.Request().Context(), cfg); err != nil {
		return c.JSON(http.StatusOK, ocrTestResultDTO{OK: false, Error: err.Error()})
	}
	return c.JSON(http.StatusOK, ocrTestResultDTO{OK: true})
}

func (s *Server) ocrConfigWithOverrides(ctx context.Context, baseURL, model string, apiKey *string) (ocr.VisionConfig, error) {
	cfg := s.effectiveVisionConfig(ctx)
	if trimmed := strings.TrimSpace(baseURL); trimmed != "" {
		if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return ocr.VisionConfig{}, errors.New("base_url must be http(s)")
		}
		cfg.BaseURL = trimmed
	}
	if trimmed := strings.TrimSpace(model); trimmed != "" {
		cfg.Model = trimmed
	}
	if apiKey != nil {
		if trimmed := strings.TrimSpace(*apiKey); trimmed != "" {
			cfg.APIKey = trimmed
			return cfg, nil
		}
	}
	existingKey := ""
	if row, err := s.deps.Store.GetOcrSettings(ctx); err == nil {
		existingKey = row.ApiKey
	} else if !errors.Is(err, sql.ErrNoRows) {
		return ocr.VisionConfig{}, err
	} else if strings.TrimSpace(cfg.APIKey) != "" {
		return cfg, nil
	}
	if existingKey != "" {
		cfg.APIKey = existingKey
	}
	return cfg, nil
}

func (s *Server) handleListOcrModels(c *echo.Context) error {
	var in ocrModelsRequestDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if trimmed := strings.TrimSpace(in.BaseURL); trimmed != "" {
		if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return Fail(http.StatusBadRequest, "bad_request", "base_url must be http(s)", nil)
		}
	}

	cfg, err := s.ocrConfigWithOverrides(c.Request().Context(), in.BaseURL, "", in.APIKey)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load ocr settings", nil)
	}

	if !cfg.AuthReady() {
		return c.JSON(http.StatusOK, ocrModelsResultDTO{
			Models: []string{},
			Error:  "set base URL and API key to fetch models",
		})
	}

	models, err := ocr.ListModels(c.Request().Context(), cfg)
	if err != nil {
		return c.JSON(http.StatusOK, ocrModelsResultDTO{
			Models: []string{},
			Error:  err.Error(),
		})
	}
	return c.JSON(http.StatusOK, ocrModelsResultDTO{Models: models})
}

func (s *Server) effectiveVisionConfig(ctx context.Context) ocr.VisionConfig {
	if s.deps.OCR != nil {
		return s.deps.OCR.Effective(ctx)
	}
	return ocr.VisionConfig{}
}

func toOcrSettingsDTO(cfg ocr.VisionConfig) ocrSettingsDTO {
	return ocrSettingsDTO{
		Enabled:       cfg.Enabled,
		BaseURL:       strings.TrimSpace(cfg.BaseURL),
		Model:         strings.TrimSpace(cfg.Model),
		CustomPrompt:  strings.TrimSpace(cfg.CustomPrompt),
		DefaultPrompt: ocr.DefaultVisionPrompt,
		APIKeySet:     strings.TrimSpace(cfg.APIKey) != "",
		APIKeyHint:    ocr.MaskAPIKeyHint(cfg.APIKey),
	}
}

func LoadOcrVisionOverlay(ctx context.Context, q store.Querier) (ocr.VisionConfig, bool, error) {
	row, err := q.GetOcrSettings(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return ocr.VisionConfig{}, false, nil
	}
	if err != nil {
		return ocr.VisionConfig{}, false, err
	}
	return ocr.VisionConfig{
		Enabled:      row.Enabled != 0,
		BaseURL:      row.BaseUrl,
		APIKey:       row.ApiKey,
		Model:        row.Model,
		CustomPrompt: row.CustomPrompt,
	}, true, nil
}
