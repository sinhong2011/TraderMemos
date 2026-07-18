package ocr

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExtractTradeFromImage_parsesJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer test-key") {
			t.Fatalf("auth header missing")
		}
		payload := map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": `{
  "symbol": "NVDA",
  "instrument_type": "option",
  "side": "long",
  "rows": [
    {"symbol":"NVDA","side":"buy","quantity":3,"price":2.3,"fees":1.25,"commission":0,"executed_at":"","option_right":"call","strike":205,"expiry":"2026-07-18"},
    {"symbol":"NVDA","side":"sell","quantity":3,"price":2.4,"fees":0.85,"commission":0,"executed_at":"","option_right":"call","strike":205,"expiry":"2026-07-18"}
  ],
  "warnings": []
}`,
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(payload)
	}))
	defer srv.Close()

	out, err := ExtractTradeFromImage(context.Background(), VisionConfig{
		Enabled:    true,
		BaseURL:    srv.URL,
		APIKey:     "test-key",
		Model:      "gpt-4o-mini",
		HTTPClient: srv.Client(),
	}, []byte("fake-png"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if out.Symbol != "NVDA" || len(out.Rows) != 2 {
		t.Fatalf("got symbol=%q rows=%d warnings=%v", out.Symbol, len(out.Rows), out.Warnings)
	}
	hasVisionWarn := false
	for _, w := range out.Warnings {
		if strings.Contains(w, "vision extract") {
			hasVisionWarn = true
		}
	}
	if !hasVisionWarn {
		t.Fatalf("expected vision warning; got %v", out.Warnings)
	}
}

func TestExtractTradeFromImage_extractsJSONFromProse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": "Here is the extract:\n```json\n{\"symbol\":\"AAPL\",\"instrument_type\":\"stock\",\"side\":\"long\",\"rows\":[{\"symbol\":\"AAPL\",\"side\":\"buy\",\"quantity\":2,\"price\":10,\"fees\":0}],\"warnings\":[]}\n```\n",
					},
				},
			},
		})
	}))
	defer srv.Close()

	out, err := ExtractTradeFromImage(context.Background(), VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	}, []byte("img"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if out.Symbol != "AAPL" || len(out.Rows) != 1 {
		t.Fatalf("got %+v", out)
	}
}

func TestExtractJSONObject(t *testing.T) {
	got := extractJSONObject("prefix {\"a\":1} trailing")
	if got != `{"a":1}` {
		t.Fatalf("got %q", got)
	}
}

func TestExtractTradeFromImage_multiSymbol(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": `{
  "symbol": "TSLA",
  "instrument_type": "stock",
  "side": "long",
  "rows": [
    {"symbol":"RAM","side":"buy","quantity":130,"price":13.07,"fees":1},
    {"symbol":"RAM","side":"sell","quantity":130,"price":12.89,"fees":1.06},
    {"symbol":"TSLA","side":"buy","quantity":3,"price":2.3,"fees":2,"option_right":"put","strike":375,"expiry":"2026-07-20"},
    {"symbol":"TSLA","side":"sell","quantity":2,"price":2.45,"fees":0.43,"option_right":"put","strike":375,"expiry":"2026-07-20"}
  ],
  "warnings": []
}`,
					},
				},
			},
		})
	}))
	defer srv.Close()

	out, err := ExtractTradeFromImage(context.Background(), VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	}, []byte("img"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Symbols) < 2 {
		t.Fatalf("expected multi symbols, got %v", out.Symbols)
	}
}

func TestService_ParseImage_requiresReadyConfig(t *testing.T) {
	svc := NewService(VisionConfig{}, nil)
	_, err := svc.ParseImage(context.Background(), []byte("x"), "image/png")
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v want ErrUnavailable", err)
	}
}

func TestService_ParseImage_usesOverlay(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": `{"symbol":"AAPL","instrument_type":"stock","side":"long","rows":[{"symbol":"AAPL","side":"buy","quantity":1,"price":10,"fees":0.5}],"warnings":[]}`,
					},
				},
			},
		})
	}))
	defer srv.Close()

	svc := NewService(VisionConfig{}, func(context.Context) (VisionConfig, bool, error) {
		return VisionConfig{
			Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
		}, true, nil
	})
	out, err := svc.ParseImage(context.Background(), []byte("img"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Rows) != 1 || out.Rows[0].Price != 10 {
		t.Fatalf("expected vision fill, got %+v", out)
	}
}

func TestMergeVisionConfig(t *testing.T) {
	got := MergeVisionConfig(
		VisionConfig{Enabled: false, BaseURL: "https://env", APIKey: "env-key", Model: "env-model"},
		VisionConfig{Enabled: true, BaseURL: "https://db", APIKey: "", Model: "db-model", CustomPrompt: "custom"},
	)
	if !got.Enabled || got.BaseURL != "https://db" || got.APIKey != "env-key" || got.Model != "db-model" || got.CustomPrompt != "custom" {
		t.Fatalf("merge: %+v", got)
	}
}

func TestVisionConfig_Ready(t *testing.T) {
	if (VisionConfig{Enabled: true, BaseURL: "https://x", APIKey: ""}).Ready() {
		t.Fatal("missing key should not be ready")
	}
	if !(VisionConfig{Enabled: true, BaseURL: "https://x", APIKey: "k"}).Ready() {
		t.Fatal("expected ready")
	}
}

func TestMaskAPIKeyHint(t *testing.T) {
	if got := MaskAPIKeyHint("sk-abcdef"); got != "…cdef" {
		t.Fatalf("got %q", got)
	}
}

func TestListModels(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer test-key") {
			t.Fatalf("auth header missing")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []any{
				map[string]any{"id": "gpt-4o"},
				map[string]any{"id": "gpt-4o-mini"},
				map[string]any{"id": "gpt-4o"},
				map[string]any{"id": ""},
			},
		})
	}))
	defer srv.Close()

	out, err := ListModels(context.Background(), VisionConfig{
		BaseURL:    srv.URL,
		APIKey:     "test-key",
		HTTPClient: srv.Client(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || out[0] != "gpt-4o" || out[1] != "gpt-4o-mini" {
		t.Fatalf("got %v", out)
	}
}

func TestListModels_requiresAuth(t *testing.T) {
	_, err := ListModels(context.Background(), VisionConfig{BaseURL: "https://x"})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v want ErrUnavailable", err)
	}
}

func TestTestVisionConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []any{map[string]any{"id": "gpt-4o-mini"}},
		})
	}))
	defer srv.Close()

	err := TestVisionConnection(context.Background(), VisionConfig{
		BaseURL:    srv.URL,
		APIKey:     "test-key",
		HTTPClient: srv.Client(),
	})
	if err != nil {
		t.Fatal(err)
	}
}
