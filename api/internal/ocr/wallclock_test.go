package ocr

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNormalizeWallClock(t *testing.T) {
	// The scan happened 2026-10-02 11:06 HKT.
	now := time.Date(2026, 10, 2, 3, 6, 0, 0, time.UTC)
	cases := []struct {
		raw  string
		want string
		ok   bool
	}{
		// Futu's history list: month/day, no year, seconds.
		{"10/01 10:31:25", "2026-10-01T10:31:25", true},
		{"10/01 10:31:25 (美東)", "2026-10-01T10:31:25", true},
		// Already canonical, with the zone the prompt forbids.
		{"2026-10-01 10:31:25", "2026-10-01T10:31:25", true},
		{"2026-10-01T10:31:25Z", "2026-10-01T10:31:25", true},
		{"2026-10-01T10:31:25-04:00", "2026-10-01T10:31:25", true},
		{"2026/10/01 10:31", "2026-10-01T10:31:00", true},
		// Year last, four or two digits; 12-hour clock.
		{"10/01/2026 9:31 AM", "2026-10-01T09:31:00", true},
		{"10/01/26 2:05:09 PM", "2026-10-01T14:05:09", true},
		{"10/01/2026 12:15 AM", "2026-10-01T00:15:00", true},
		// Day-first only when the first number can't be a month.
		{"25/09 10:00", "2026-09-25T10:00:00", true},
		// A yearless date after the scan is last year's, not next year's.
		{"12/30 15:59:59", "2025-12-30T15:59:59", true},
		// …but today and tomorrow (the screen's zone can run ahead) stay put.
		{"10/02 09:30", "2026-10-02T09:30:00", true},
		{"10/03 09:30", "2026-10-03T09:30:00", true},
		{"2026-10-01", "2026-10-01T00:00:00", true},
		// Not dates: left for the warning.
		{"10:31:25", "10:31:25", false},
		{"yesterday", "yesterday", false},
		{"02/30 10:00", "02/30 10:00", false},
		{"13/13 10:00", "13/13 10:00", false},
		{"10/01 25:00", "10/01 25:00", false},
	}
	for _, c := range cases {
		got, ok := normalizeWallClock(c.raw, now)
		if got != c.want || ok != c.ok {
			t.Errorf("normalizeWallClock(%q) = %q, %v; want %q, %v", c.raw, got, ok, c.want, c.ok)
		}
	}
}

// The Gemini reply for a real Futu history screenshot (2026-10-02), minus the
// cancelled QQQ order the prompt now tells it to skip.
const futuHistoryReply = `{
  "symbol": "SPCX", "instrument_type": "option", "side": "short",
  "rows": [
    {"symbol":"SPCX","side":"sell","quantity":1,"price":2.90,"executed_at":"10/01 10:31:25","option_right":"call","strike":155,"expiry":"2026-10-09"},
    {"symbol":"SPCX","side":"sell","quantity":1,"price":2.88,"executed_at":"10/01 10:30:44","option_right":"call","strike":155,"expiry":"2026-10-09"},
    {"symbol":"SPCX","side":"buy","quantity":2,"price":2.75,"executed_at":"10/01 10:30:27","option_right":"call","strike":155,"expiry":"2026-10-09"},
    {"symbol":"PLTR","side":"sell","quantity":1,"price":1.95,"executed_at":"10/01 10:10:22","option_right":"call","strike":192.5,"expiry":"2026-10-02"},
    {"symbol":"PLTR","side":"sell","quantity":1,"price":2.20,"executed_at":"10/01 10:08:52","option_right":"call","strike":192.5,"expiry":"2026-10-02"},
    {"symbol":"PLTR","side":"buy","quantity":2,"price":2.09,"executed_at":"10/01 10:08:13","option_right":"call","strike":192.5,"expiry":"2026-10-02"},
    {"symbol":"PLTR","side":"buy","quantity":1,"price":2.00,"executed_at":"sometime","option_right":"call","strike":192.5,"expiry":"2026-10-02"}
  ],
  "warnings": []
}`

func TestExtractTradeFromImage_normalizesFutuTimes(t *testing.T) {
	prev := nowFunc
	nowFunc = func() time.Time { return time.Date(2026, 10, 2, 3, 6, 0, 0, time.UTC) }
	defer func() { nowFunc = prev }()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{map[string]any{"message": map[string]any{"content": futuHistoryReply}}},
		})
	}))
	defer srv.Close()

	out, err := ExtractTradeFromImage(context.Background(), VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	}, []byte{0x89, 0x50}, "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Rows) != 7 {
		t.Fatalf("rows = %d, want 7", len(out.Rows))
	}
	// Sorted chronologically once the times compare as ISO strings; the
	// unreadable one sorts last and keeps its raw text.
	wantTimes := []string{
		"2026-10-01T10:08:13", "2026-10-01T10:08:52", "2026-10-01T10:10:22",
		"2026-10-01T10:30:27", "2026-10-01T10:30:44", "2026-10-01T10:31:25", "sometime",
	}
	for i, r := range out.Rows {
		if r.ExecutedAt != wantTimes[i] {
			t.Errorf("row %d executed_at = %q, want %q", i, r.ExecutedAt, wantTimes[i])
		}
	}
	// The model said "short"; the majority symbol (PLTR, 4 rows) opened with
	// a buy, so it's long.
	if out.Symbol != "PLTR" || out.Side != "long" {
		t.Errorf("symbol/side = %s/%s, want PLTR/long", out.Symbol, out.Side)
	}
	if !strings.Contains(strings.Join(out.Warnings, "\n"), "couldn't read the time of 1 fill(s)") {
		t.Errorf("missing unread-time warning: %v", out.Warnings)
	}
}

func TestDefaultVisionPrompt_skipsUnfilledOrders(t *testing.T) {
	for _, want := range []string{"已撤單", "未成交", "Cancelled", "filled quantity"} {
		if !strings.Contains(DefaultVisionPrompt, want) {
			t.Errorf("prompt lacks %q", want)
		}
	}
}
