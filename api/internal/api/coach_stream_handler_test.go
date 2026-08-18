package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/ocr"
)

// sseFrames splits an SSE body into (event, data) pairs in arrival order.
func sseFrames(t *testing.T, body string) [][2]string {
	t.Helper()
	var out [][2]string
	for _, block := range strings.Split(strings.TrimSpace(body), "\n\n") {
		var event, data string
		for _, line := range strings.Split(block, "\n") {
			switch {
			case strings.HasPrefix(line, "event: "):
				event = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "data: "):
				data = strings.TrimPrefix(line, "data: ")
			}
		}
		if event != "" {
			out = append(out, [2]string{event, data})
		}
	}
	return out
}

// streamingLLM replays a JSON payload as an OpenAI-compatible stream, split
// into chunks so notes complete across frame boundaries.
func streamingLLM(t *testing.T, payload string, chunkSize int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fl, ok := w.(http.Flusher)
		require.True(t, ok)
		for i := 0; i < len(payload); i += chunkSize {
			end := min(i+chunkSize, len(payload))
			enc, err := json.Marshal(payload[i:end])
			require.NoError(t, err)
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\n", enc)
			fl.Flush()
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
		fl.Flush()
	}))
}

func TestTradeCoachStream_pushesNotesThenDone(t *testing.T) {
	payload := `{"notes":[{"tone":"warn","headline":"Sized up","detail":"1.8x median."},` +
		`{"tone":"tip","headline":"Journal it","detail":"Write it down."}],` +
		`"next_action":"Size at or below 1R."}`
	llm := streamingLLM(t, payload, 40)
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-stream@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)

	rec := do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach/stream", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Contains(t, rec.Header().Get("Content-Type"), "text/event-stream")

	frames := sseFrames(t, rec.Body.String())
	require.GreaterOrEqual(t, len(frames), 3, "two notes plus done")

	require.Equal(t, "note", frames[0][0])
	require.Equal(t, "note", frames[1][0])
	require.Contains(t, frames[0][1], "Sized up")
	require.Contains(t, frames[1][1], "Journal it")

	last := frames[len(frames)-1]
	require.Equal(t, "done", last[0])
	var done struct {
		Source     string `json:"source"`
		NextAction string `json:"next_action"`
		ID         string `json:"id"`
		Notes      []struct {
			Headline string `json:"headline"`
		} `json:"notes"`
	}
	require.NoError(t, json.Unmarshal([]byte(last[1]), &done))
	require.Equal(t, "llm", done.Source)
	require.Equal(t, "Size at or below 1R.", done.NextAction)
	require.Len(t, done.Notes, 2)
	require.NotEmpty(t, done.ID, "a streamed review is persisted like a blocking one")

	// The stored history holds the same review.
	rec = do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", tok)
	var hist struct {
		Reviews []struct {
			ID         string `json:"id"`
			NextAction string `json:"next_action"`
		} `json:"reviews"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &hist))
	require.Len(t, hist.Reviews, 1)
	require.Equal(t, done.ID, hist.Reviews[0].ID)
	require.Equal(t, "Size at or below 1R.", hist.Reviews[0].NextAction)
}

// An upstream failure arrives as an error event, not an HTTP status — the 200
// and the headers are already on the wire by the time it happens.
func TestTradeCoachStream_upstreamFailureIsAnErrorEvent(t *testing.T) {
	llm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer llm.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-stream-err@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	body := `{"enabled":true,"base_url":"` + llm.URL + `","model":"gpt-test","api_key":"sk"}`
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/settings/coach", body, tok).Code)

	rec := do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach/stream", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)

	frames := sseFrames(t, rec.Body.String())
	require.Len(t, frames, 1)
	require.Equal(t, "error", frames[0][0])
	require.Contains(t, frames[0][1], "message")

	// Nothing was stored: history holds advice, not failures.
	rec = do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/coach/reviews", "", tok)
	var hist struct {
		Reviews []map[string]any `json:"reviews"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &hist))
	require.Empty(t, hist.Reviews)
}

func TestTradeCoachStream_offWhenDisabled(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-stream-off@example.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	rec := do(s, http.MethodPost, "/api/v1/trades/"+tradeID+"/coach/stream", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "off", got["source"])
}

func TestTradeCoachStream_notFound(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "coach-stream-404@example.com")
	rec := do(s, http.MethodPost, "/api/v1/trades/nope/coach/stream", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}
