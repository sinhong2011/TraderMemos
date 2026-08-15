package coach

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/ocr"
)

func TestFormatTradeContext(t *testing.T) {
	net := 100.0
	r := 2.0
	out := FormatTradeContext(TradeContext{
		Symbol:    "AAPL",
		Direction: "long",
		Status:    "closed",
		OpenedAt:  time.Date(2026, 7, 1, 14, 0, 0, 0, time.UTC),
		NetPnl:    &net,
		Currency:  "USD",
		RMultiple: &r,
		Notes:     "entry: breakout",
		TagNames:  []string{"orb"},
		Fills: []FillContext{{
			Side: "buy", Quantity: 10, Price: 190, ExecutedAt: time.Date(2026, 7, 1, 14, 0, 0, 0, time.UTC),
		}},
	})
	for _, want := range []string{"AAPL", "Net P&L: 100", "R-multiple: 2", "entry: breakout", "orb", "buy 10 @ 190"} {
		require.Contains(t, out, want)
	}
}

func TestGenerateReview(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			http.NotFound(w, r)
			return
		}
		var req chatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode: %v", err)
			http.Error(w, "bad", 400)
			return
		}
		if req.Model != "gpt-test" {
			t.Errorf("model=%s", req.Model)
		}
		if len(req.Messages) != 2 {
			t.Errorf("messages=%d", len(req.Messages))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"content": `{"notes":[{"tone":"warn","headline":"Cut winners early","detail":"MFE capture was weak."},{"tone":"pos","headline":"Plan followed","detail":"Stop and target were set."}]}`,
				},
			}},
		})
	}))
	defer srv.Close()

	rev, err := GenerateReview(context.Background(), ocr.VisionConfig{
		Enabled:    true,
		BaseURL:    srv.URL,
		APIKey:     "sk-test",
		Model:      "gpt-test",
		HTTPClient: srv.Client(),
	}, TradeContext{Symbol: "AAPL", Direction: "long", Status: "closed", OpenedAt: time.Now().UTC()})
	require.NoError(t, err)
	require.Len(t, rev.Notes, 2)
	require.Equal(t, "warn", rev.Notes[0].Tone)
	require.Equal(t, "Cut winners early", rev.Notes[0].Headline)
	require.Equal(t, "pos", rev.Notes[1].Tone)
}

func TestGenerateReview_Unavailable(t *testing.T) {
	_, err := GenerateReview(context.Background(), ocr.VisionConfig{}, TradeContext{})
	require.ErrorIs(t, err, ErrUnavailable)
}

func TestGenerateReview_CapsNotes(t *testing.T) {
	notes := make([]map[string]string, 8)
	for i := range notes {
		notes[i] = map[string]string{"tone": "tip", "headline": "H", "detail": "D"}
	}
	payload, _ := json.Marshal(map[string]any{"notes": notes})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{"content": string(payload)},
			}},
		})
	}))
	defer srv.Close()

	rev, err := GenerateReview(context.Background(), ocr.VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	}, TradeContext{Symbol: "X", OpenedAt: time.Now().UTC()})
	require.NoError(t, err)
	require.Len(t, rev.Notes, maxNotes)
}

func TestNormalizeTone(t *testing.T) {
	cases := map[string]string{
		"NEG": "neg", "warning": "warn", "Strength": "pos", "habit": "tip", "": "tip",
	}
	for in, want := range cases {
		require.Equal(t, want, normalizeTone(in), "input %q", in)
	}
}
