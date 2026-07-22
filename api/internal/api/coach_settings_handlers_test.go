package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/ocr"
)

func TestCoachSettings_roundTripAndMask(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{
		Enabled: false,
		BaseURL: "https://api.openai.com/v1",
		Model:   "gpt-4o-mini",
	})
	tok := registerAndLogin(t, s, "coach-settings@example.com")

	rec := do(s, http.MethodGet, "/api/v1/settings/coach", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, false, got["enabled"])
	require.Equal(t, false, got["api_key_set"])

	body := `{"enabled":true,"base_url":"https://coach.example/v1","model":"gpt-4o-mini","api_key":"sk-coach-key-9999"}`
	rec = do(s, http.MethodPut, "/api/v1/settings/coach", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["enabled"])
	require.Equal(t, true, got["api_key_set"])
	require.Equal(t, "…9999", got["api_key_hint"])
	require.NotContains(t, rec.Body.String(), "sk-coach-key-9999")
}

func TestCoachSettings_testConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []any{map[string]any{"id": "gpt-4o-mini"}},
		})
	}))
	defer srv.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-test@example.com")

	body := `{"base_url":"` + srv.URL + `","model":"gpt-4o-mini","api_key":"k"}`
	rec := do(s, http.MethodPost, "/api/v1/settings/coach/test", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["ok"])
}
