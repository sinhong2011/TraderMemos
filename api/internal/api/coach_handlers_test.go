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

// A generated review is stored, so the trade page can show it again without
// spending another model call.
func TestTradeCoach_persistsAndListsReviews(t *testing.T) {
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{map[string]any{
				"message": map[string]any{
					"content": `{"notes":[{"tone":"warn","headline":"Sized up","detail":"1.8x median risk."}],"next_action":"Size at or below 1R."}`,
				},
			}},
		})
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-store@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)

	// History starts empty.
	rec := do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var empty struct {
		Reviews []map[string]any `json:"reviews"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &empty))
	require.Empty(t, empty.Reviews)

	rec = do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var gen struct {
		ID        string `json:"id"`
		CreatedAt string `json:"created_at"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &gen))
	require.NotEmpty(t, gen.ID, "a stored review reports its id")
	require.NotEmpty(t, gen.CreatedAt)

	rec = do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got struct {
		Reviews []struct {
			ID         string `json:"id"`
			Model      string `json:"model"`
			NextAction string `json:"next_action"`
			Notes      []struct {
				Tone     string `json:"tone"`
				Headline string `json:"headline"`
			} `json:"notes"`
		} `json:"reviews"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Len(t, got.Reviews, 1)
	require.Equal(t, gen.ID, got.Reviews[0].ID)
	require.Equal(t, "gpt-test", got.Reviews[0].Model)
	require.Equal(t, "Size at or below 1R.", got.Reviews[0].NextAction)
	require.Len(t, got.Reviews[0].Notes, 1)
	require.Equal(t, "Sized up", got.Reviews[0].Notes[0].Headline)
}

// One trader must never see another's stored reviews.
func TestTradeCoachReviews_scopedToOwner(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-owner@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	other := registerAndLogin(t, s, "coach-other@example.com")
	rec := do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", other)
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
}

func TestTradeCoachReviews_notFound(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-rev-404@example.com")
	rec := do(s, http.MethodGet, "/api/v1/trades/does-not-exist/coach/reviews", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

// A failed review is not stored — history should hold advice, not errors.
func TestTradeCoach_errorIsNotPersisted(t *testing.T) {
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-noerr@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach", "", tok).Code)

	rec := do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", tok)
	var got struct {
		Reviews []map[string]any `json:"reviews"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Empty(t, got.Reviews)
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
