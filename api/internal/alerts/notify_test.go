package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testService() *Service {
	// httptest servers listen on loopback, so the webhook client must allow
	// private addresses here.
	return &Service{httpc: http.DefaultClient, webhookc: newWebhookClient(true), now: time.Now}
}

func TestWebhookClientBlocksPrivateTargets(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("guarded client must not reach a loopback server")
	}))
	defer srv.Close()
	s := &Service{httpc: http.DefaultClient, webhookc: newWebhookClient(false), now: time.Now}
	err := s.sendWebhook(context.Background(), srv.URL, Event{Title: "t"}, time.Now())
	if err == nil {
		t.Fatal("want dial refusal for loopback webhook target")
	}
}

func TestSendWebhookPayload(t *testing.T) {
	var got webhookPayload
	var title string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		title = r.Header.Get("X-Title")
	}))
	defer srv.Close()

	ev := Event{Rule: RuleDailyLoss, Title: "Daily loss limit hit", Body: "Down 600."}
	if err := testService().sendWebhook(context.Background(), srv.URL, ev, time.Unix(1754500000, 0)); err != nil {
		t.Fatal(err)
	}
	if got.Source != "tradermemos" || got.Rule != RuleDailyLoss {
		t.Errorf("payload metadata wrong: %+v", got)
	}
	// Discord (`content`) and Slack (`text`) fields must mirror title+body.
	want := "Daily loss limit hit — Down 600."
	if got.Content != want || got.Text != want {
		t.Errorf("content/text = %q / %q, want %q", got.Content, got.Text, want)
	}
	if title != "Daily loss limit hit" {
		t.Errorf("X-Title = %q", title)
	}
}

func TestSendWebhookErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()
	err := testService().sendWebhook(context.Background(), srv.URL, Event{Title: "t"}, time.Now())
	if err == nil {
		t.Fatal("5xx must surface as an error")
	}
}

func TestSendExpoTicketErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []expoMessage
		body, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(body, &msgs); err != nil || len(msgs) != 2 {
			t.Errorf("want a 2-message batch, got %s", body)
		}
		_, _ = w.Write([]byte(`{"data":[
			{"status":"ok"},
			{"status":"error","message":"gone","details":{"error":"DeviceNotRegistered"}}
		]}`))
	}))
	defer srv.Close()
	orig := expoPushURL
	expoPushURL = srv.URL
	defer func() { expoPushURL = orig }()

	errs, err := testService().sendExpo(context.Background(), []string{"ExponentPushToken[a]", "ExponentPushToken[b]"}, Event{Title: "t", Body: "b"})
	if err != nil {
		t.Fatal(err)
	}
	if errs[0] != nil {
		t.Errorf("first token should deliver, got %v", errs[0])
	}
	if !errors.Is(errs[1], errDeviceNotRegistered) {
		t.Errorf("second token should be DeviceNotRegistered, got %v", errs[1])
	}
}

// The cooldown push (and the "tap to start a cooldown" alerts) carry an
// in-app deep link the app routes on; a dropped or renamed `data` field
// silently turns those notifications back into dead ends.
func TestSendExpoCarriesDeepLink(t *testing.T) {
	var msgs []expoMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &msgs)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer srv.Close()
	orig := expoPushURL
	expoPushURL = srv.URL
	defer func() { expoPushURL = orig }()

	ev := Event{Rule: "cooldown", Title: "Cooldown started — 15 min", Body: "Breathe.", URL: "tradermemos://cooldown"}
	if _, err := testService().sendExpo(context.Background(), []string{"ExponentPushToken[a]"}, ev); err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 1 {
		t.Fatalf("want one message, got %d", len(msgs))
	}
	if msgs[0].Data["url"] != "tradermemos://cooldown" || msgs[0].Data["rule"] != "cooldown" {
		t.Errorf("data payload = %+v, want the deep link and rule", msgs[0].Data)
	}

	// An event without a URL must not ship an empty data bag — the app
	// treats a present-but-blank url as a route and would push nowhere.
	msgs = nil
	if _, err := testService().sendExpo(context.Background(), []string{"ExponentPushToken[a]"}, Event{Title: "t"}); err != nil {
		t.Fatal(err)
	}
	if msgs[0].Data != nil {
		t.Errorf("data = %+v, want nil when the event has no URL", msgs[0].Data)
	}
	raw, _ := json.Marshal(msgs[0])
	if bytes.Contains(raw, []byte(`"data"`)) {
		t.Errorf("marshalled message should omit data entirely: %s", raw)
	}
}

// The webhook mirror of the same link, for subscribers that route on it.
func TestSendWebhookCarriesDeepLink(t *testing.T) {
	var got webhookPayload
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
	}))
	defer srv.Close()

	ev := Event{Rule: RuleLossStreak, Title: "3 losses in a row", Body: "Step back.", URL: "tradermemos://cooldown?suggest=loss_streak"}
	if err := testService().sendWebhook(context.Background(), srv.URL, ev, time.Unix(1754500000, 0)); err != nil {
		t.Fatal(err)
	}
	if got.URL != ev.URL {
		t.Errorf("url = %q, want %q", got.URL, ev.URL)
	}
}
