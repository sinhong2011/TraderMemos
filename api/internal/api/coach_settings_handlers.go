package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/coach"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/store"
)

type coachSettingsDTO struct {
	Enabled       bool   `json:"enabled"`
	BaseURL       string `json:"base_url"`
	Model         string `json:"model"`
	CustomPrompt  string `json:"custom_prompt"`
	DefaultPrompt string `json:"default_prompt"`
	APIKeySet     bool   `json:"api_key_set"`
	APIKeyHint    string `json:"api_key_hint,omitempty"`
}

type coachSettingsPutDTO struct {
	Enabled      bool   `json:"enabled"`
	BaseURL      string `json:"base_url"`
	Model        string `json:"model"`
	CustomPrompt string `json:"custom_prompt"`
	APIKey       *string `json:"api_key"`
}

type coachTestRequestDTO struct {
	BaseURL string  `json:"base_url"`
	Model   string  `json:"model"`
	APIKey  *string `json:"api_key"`
}

type coachModelsRequestDTO struct {
	BaseURL string  `json:"base_url"`
	APIKey  *string `json:"api_key"`
}

func (s *Server) handleGetCoachSettings(c echo.Context) error {
	cfg := s.effectiveCoachConfig(c.Request().Context())
	return c.JSON(http.StatusOK, toCoachSettingsDTO(cfg))
}

func (s *Server) handlePutCoachSettings(c echo.Context) error {
	var in coachSettingsPutDTO
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
	if row, err := s.deps.Store.GetCoachSettings(c.Request().Context()); err == nil {
		existingKey = row.ApiKey
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not load coach settings", nil)
	} else if strings.TrimSpace(s.deps.CoachDefaults.APIKey) != "" {
		existingKey = s.deps.CoachDefaults.APIKey
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
	_, err := s.deps.Store.UpsertCoachSettings(c.Request().Context(), store.UpsertCoachSettingsParams{
		Enabled:      enabled,
		BaseUrl:      in.BaseURL,
		ApiKey:       apiKey,
		Model:        in.Model,
		CustomPrompt: in.CustomPrompt,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save coach settings", nil)
	}

	cfg := s.effectiveCoachConfig(c.Request().Context())
	return c.JSON(http.StatusOK, toCoachSettingsDTO(cfg))
}

func (s *Server) handleTestCoachSettings(c echo.Context) error {
	var in coachTestRequestDTO
	_ = c.Bind(&in)
	if trimmed := strings.TrimSpace(in.BaseURL); trimmed != "" {
		if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return Fail(http.StatusBadRequest, "bad_request", "base_url must be http(s)", nil)
		}
	}

	cfg, err := s.coachConfigWithOverrides(c.Request().Context(), in.BaseURL, in.Model, in.APIKey)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load coach settings", nil)
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

func (s *Server) handleListCoachModels(c echo.Context) error {
	var in coachModelsRequestDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if trimmed := strings.TrimSpace(in.BaseURL); trimmed != "" {
		if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
			return Fail(http.StatusBadRequest, "bad_request", "base_url must be http(s)", nil)
		}
	}

	cfg, err := s.coachConfigWithOverrides(c.Request().Context(), in.BaseURL, "", in.APIKey)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load coach settings", nil)
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

func (s *Server) coachConfigWithOverrides(ctx context.Context, baseURL, model string, apiKey *string) (ocr.VisionConfig, error) {
	cfg := s.effectiveCoachConfig(ctx)
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
	if row, err := s.deps.Store.GetCoachSettings(ctx); err == nil {
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

func (s *Server) effectiveCoachConfig(ctx context.Context) ocr.VisionConfig {
	cfg := s.deps.CoachDefaults
	overlay, ok, err := LoadCoachOverlay(ctx, s.deps.Store)
	if err != nil || !ok {
		return cfg
	}
	return ocr.MergeVisionConfig(cfg, overlay)
}

func toCoachSettingsDTO(cfg ocr.VisionConfig) coachSettingsDTO {
	return coachSettingsDTO{
		Enabled:       cfg.Enabled,
		BaseURL:       strings.TrimSpace(cfg.BaseURL),
		Model:         strings.TrimSpace(cfg.Model),
		CustomPrompt:  strings.TrimSpace(cfg.CustomPrompt),
		DefaultPrompt: coach.DefaultCoachPrompt,
		APIKeySet:     strings.TrimSpace(cfg.APIKey) != "",
		APIKeyHint:    ocr.MaskAPIKeyHint(cfg.APIKey),
	}
}

func LoadCoachOverlay(ctx context.Context, q store.Querier) (ocr.VisionConfig, bool, error) {
	row, err := q.GetCoachSettings(ctx)
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
