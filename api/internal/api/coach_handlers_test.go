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

// End-to-end proof that the cross-trade context actually reaches the model:
// the handler must load the account's history, score the trade, and render
// both blocks into the prompt. Unit tests cover the builders in isolation;
// only this covers the plumbing between them.
func TestTradeCoach_promptCarriesHistoryContext(t *testing.T) {
	var prompt string
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		for _, m := range req.Messages {
			if m.Role == "user" {
				prompt = m.Content
			}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{map[string]any{
				"message": map[string]any{
					"content": `{"notes":[{"tone":"tip","headline":"H","detail":"D"}],"next_action":"Do the thing."}`,
				},
			}},
		})
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-ctx@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)

	rec := do(s, http.MethodPost,
		"/api/v1/trades/"+tradeID+"/coach?tz=America/New_York", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	require.Contains(t, prompt, "Trader state at the moment this trade was entered")
	require.Contains(t, prompt, "Execution quality for this trade")
	require.Contains(t, prompt, "next_action")

	var got struct {
		NextAction string `json:"next_action"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "Do the thing.", got.NextAction)
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
