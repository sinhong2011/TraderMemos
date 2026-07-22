package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/ocr"
)

func TestTradeCoach_offWhenDisabled(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-off@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "off", got["source"])
	require.Equal(t, []any{}, got["notes"])
}

func TestTradeCoach_llmNotes(t *testing.T) {
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/chat/completions", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": `{"notes":[{"tone":"tip","headline":"Journal the exit","detail":"Write why you closed while it is fresh."}]}`,
					},
				},
			},
		})
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-llm@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk-coach"}`
	rec := do(s, http.MethodPut, "/api/v1/settings/coach", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got struct {
		Source string `json:"source"`
		Notes  []struct {
			Tone     string `json:"tone"`
			Headline string `json:"headline"`
			Detail   string `json:"detail"`
		} `json:"notes"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "llm", got.Source)
	require.Len(t, got.Notes, 1)
	require.Equal(t, "tip", got.Notes[0].Tone)
	require.Equal(t, "Journal the exit", got.Notes[0].Headline)
}

func TestTradeCoach_errorFallsBackGracefully(t *testing.T) {
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-err@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)

	rec := do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "error", got["source"])
	require.NotEmpty(t, got["error"])
}

func TestTradeCoach_notFound(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-404@example.com")
	rec := do(s, http.MethodPost, "/api/v1/trades/missing/coach", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}
