package coach

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
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
	if err != nil {
		t.Fatal(err)
	}
	if len(rev.Notes) != 2 {
		t.Fatalf("notes=%d", len(rev.Notes))
	}
	if rev.Notes[0].Tone != "warn" || rev.Notes[0].Headline != "Cut winners early" {
		t.Fatalf("note0=%+v", rev.Notes[0])
	}
	if rev.Notes[1].Tone != "pos" {
		t.Fatalf("note1=%+v", rev.Notes[1])
	}
}

func TestGenerateReview_Unavailable(t *testing.T) {
	_, err := GenerateReview(context.Background(), ocr.VisionConfig{}, TradeContext{})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v want ErrUnavailable", err)
	}
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
	if err != nil {
		t.Fatal(err)
	}
	if len(rev.Notes) != maxNotes {
		t.Fatalf("got %d want %d", len(rev.Notes), maxNotes)
	}
}

func TestNormalizeTone(t *testing.T) {
	cases := map[string]string{
		"NEG": "neg", "warning": "warn", "Strength": "pos", "habit": "tip", "": "tip",
	}
	for in, want := range cases {
		if got := normalizeTone(in); got != want {
			t.Fatalf("%q -> %q want %q", in, got, want)
		}
	}
}
