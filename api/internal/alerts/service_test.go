package alerts

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

// fireFixture is a real sqlite-backed service with one user and one
// registered push token — the shape Fire runs against in production.
type fireFixture struct {
	svc  *Service
	user string
	// pushed collects every Expo batch the stub gateway received.
	pushed *[][]expoMessage
}

func newFireFixture(t *testing.T) *fireFixture {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(conn); err != nil {
		t.Fatal(err)
	}
	q := store.NewForDriver(conn, "sqlite")
	ctx := context.Background()
	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: "u1", Email: "t@example.com", PasswordHash: "x", IsAdmin: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.UpsertAlertChannel(ctx, store.UpsertAlertChannelParams{
		ID: "c1", UserID: u.ID, Kind: "expo", Target: "ExponentPushToken[a]", Label: "iPhone",
	}); err != nil {
		t.Fatal(err)
	}

	var batches [][]expoMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []expoMessage
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &msgs)
		batches = append(batches, msgs)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	t.Cleanup(srv.Close)
	orig := expoPushURL
	expoPushURL = srv.URL
	t.Cleanup(func() { expoPushURL = orig })

	svc := &Service{
		q: q, log: slog.Default(), httpc: http.DefaultClient,
		webhookc: newWebhookClient(true), now: time.Now, inflight: map[string]bool{},
	}
	return &fireFixture{svc: svc, user: u.ID, pushed: &batches}
}

// Fire is the seam the cooldown service speaks through: one push per
// session, and the alert_events unique index is what stops a re-evaluation
// from announcing the same session twice.
func TestFireDeliversOnceAndCarriesTheDeepLink(t *testing.T) {
	f := newFireFixture(t)
	ctx := context.Background()
	ev := Event{
		Rule:      "cooldown",
		DedupeKey: "session-1",
		Title:     "Cooldown started — 15 min",
		Body:      "You hit your loss streak limit.",
		URL:       "tradermemos://cooldown",
	}

	if err := f.svc.Fire(ctx, f.user, ev); err != nil {
		t.Fatal(err)
	}
	if len(*f.pushed) != 1 {
		t.Fatalf("want one push, got %d", len(*f.pushed))
	}
	msg := (*f.pushed)[0][0]
	if msg.To != "ExponentPushToken[a]" || msg.Title != ev.Title {
		t.Errorf("push = %+v", msg)
	}
	if msg.Data["url"] != ev.URL {
		t.Errorf("data.url = %q, want %q", msg.Data["url"], ev.URL)
	}

	// Same session again (a second evaluation of the same trade write):
	// the dedupe row already exists, so nothing goes out.
	if err := f.svc.Fire(ctx, f.user, ev); err != nil {
		t.Fatal(err)
	}
	if len(*f.pushed) != 1 {
		t.Fatalf("re-firing the same dedupe key must stay silent, got %d pushes", len(*f.pushed))
	}

	// A different session does announce.
	ev.DedupeKey = "session-2"
	if err := f.svc.Fire(ctx, f.user, ev); err != nil {
		t.Fatal(err)
	}
	if len(*f.pushed) != 2 {
		t.Fatalf("a new session should push, got %d", len(*f.pushed))
	}
}

// A user with no registered device is not an error — the session still
// starts, it just isn't announced.
func TestFireWithoutChannelsIsQuiet(t *testing.T) {
	f := newFireFixture(t)
	ctx := context.Background()
	if err := f.svc.q.DisableAlertChannel(ctx, "c1"); err != nil {
		t.Fatal(err)
	}
	if err := f.svc.Fire(ctx, f.user, Event{Rule: "cooldown", DedupeKey: "s", Title: "t"}); err != nil {
		t.Fatalf("Fire with no enabled channels: %v", err)
	}
	if len(*f.pushed) != 0 {
		t.Fatalf("want no pushes, got %d", len(*f.pushed))
	}
}
