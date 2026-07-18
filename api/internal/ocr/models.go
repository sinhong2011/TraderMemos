package ocr

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

// AuthReady is true when base URL + API key are set (enabled flag not required).
func (c VisionConfig) AuthReady() bool {
	return strings.TrimSpace(c.BaseURL) != "" && strings.TrimSpace(c.APIKey) != ""
}

type modelsAPIResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// ListModels fetches model IDs from an OpenAI-compatible GET /models endpoint.
func ListModels(ctx context.Context, cfg VisionConfig) ([]string, error) {
	if !cfg.AuthReady() {
		return nil, fmt.Errorf("%w: vision base URL and API key required", ErrUnavailable)
	}

	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	url := base + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cfg.APIKey))
	req.Header.Set("Accept", "application/json")

	res, err := cfg.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("models api %s: %s", res.Status, truncateRunes(string(raw), 300))
	}

	var api modelsAPIResponse
	if err := json.Unmarshal(raw, &api); err != nil {
		return nil, fmt.Errorf("models decode: %w", err)
	}
	if api.Error != nil && api.Error.Message != "" {
		return nil, fmt.Errorf("models api: %s", api.Error.Message)
	}

	seen := make(map[string]struct{}, len(api.Data))
	out := make([]string, 0, len(api.Data))
	for _, m := range api.Data {
		id := strings.TrimSpace(m.ID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Strings(out)
	return out, nil
}

// TestVisionConnection checks base URL + API key via GET /models (no vision parse).
func TestVisionConnection(ctx context.Context, cfg VisionConfig) error {
	_, err := ListModels(ctx, cfg)
	return err
}
