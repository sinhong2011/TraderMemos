package jobs_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
	"uuid"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/jobs"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// hookSink collects webhook deliveries.
type hookSink struct {
	mu   sync.Mutex
	got  []map[string]any
	srv  *httptest.Server
	hits int
}

func newHookSink(t *testing.T) *hookSink {
	h := &hookSink{}
	h.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var m map[string]any
		_ = json.Unmarshal(body, &m)
		h.mu.Lock()
		h.got = append(h.got, m)
		h.hits++
		h.mu.Unlock()
	}))
	t.Cleanup(h.srv.Close)
	return h
}

func (h *hookSink) payloads() []map[string]any {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]map[string]any(nil), h.got...)
}

type weeklyFixture struct {
	q      *store.Queries
	userID string
	acctID string
	hook   *hookSink
	ny     *time.Location
}

// newWeeklyFixture builds a user with alerts on (weekly review left at its
// default), a webhook channel, an America/New_York market timezone synced
// through preferences, and an empty USD account.
func newWeeklyFixture(t *testing.T) *weeklyFixture {
	t.Helper()
	ctx := context.Background()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)

	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.New().String(), Email: uuid.New().String() + "@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.New().String(), UserID: u.ID, Name: "Main",
		Broker: "manual", AccountType: "margin", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)
	// Insert through the raw table so the column default (on) is what the
	// test exercises, exactly as for a user who enabled alerts pre-migration.
	_, err = conn.Exec(`INSERT INTO alert_settings (user_id, enabled) VALUES (?, 1)`, u.ID)
	require.NoError(t, err)
	_, err = q.UpsertUserPreferences(ctx, store.UpsertUserPreferencesParams{
		UserID: u.ID, Prefs: `{"marketTimezone":"America/New_York","timeFormat":"24h"}`,
	})
	require.NoError(t, err)

	hook := newHookSink(t)
	_, err = q.UpsertAlertChannel(ctx, store.UpsertAlertChannelParams{
		ID: uuid.New().String(), UserID: u.ID, Kind: "webhook", Target: hook.srv.URL, Label: "test",
	})
	require.NoError(t, err)

	ny, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	return &weeklyFixture{q: q, userID: u.ID, acctID: acc.ID, hook: hook, ny: ny}
}

// trade books one 100-share round trip that closes at closedAt.
func (f *weeklyFixture) trade(t *testing.T, symbol string, entry, exit float64, closedAt time.Time) {
	t.Helper()
	ctx := context.Background()
	for i, leg := range []struct {
		side  string
		price float64
		at    time.Time
	}{
		{"buy", entry, closedAt.Add(-30 * time.Minute)},
		{"sell", exit, closedAt},
	} {
		_, err := f.q.InsertExecution(ctx, store.InsertExecutionParams{
			ID: uuid.New().String(), UserID: f.userID, AccountID: f.acctID,
			Symbol: symbol, InstrumentType: "stock", Side: leg.side,
			Quantity: 100, Price: leg.price, ExecutedAt: leg.at.UTC(), Multiplier: 1,
			DedupHash: uuid.New().String() + string(rune('a'+i)),
		})
		require.NoError(t, err)
	}
	require.NoError(t, trades.NewService(f.q).Regroup(ctx, f.userID, f.acctID))
}

// run executes one pass of the job with a fresh service — a fresh process,
// as after a restart — at now.
func (f *weeklyFixture) run(t *testing.T, now time.Time) {
	t.Helper()
	svc := alerts.NewService(f.q, slog.New(slog.NewTextHandler(io.Discard, nil)), true)
	job := jobs.NewWeeklyReview(f.q, svc, time.Hour, 0, func() time.Time { return now }, slog.New(slog.NewTextHandler(io.Discard, nil)))
	require.NoError(t, job.Run(context.Background()))
}

func (f *weeklyFixture) reviews(t *testing.T) []store.JournalNote {
	t.Helper()
	notes, err := f.q.ListJournalNotes(context.Background(), store.ListJournalNotesParams{UserID: f.userID})
	require.NoError(t, err)
	var out []store.JournalNote
	for _, n := range notes {
		if n.NoteType == alerts.NoteTypeWeeklyReview {
			out = append(out, n)
		}
	}
	return out
}

func TestWeeklyReviewFiresOnceAtSaturdayNine(t *testing.T) {
	f := newWeeklyFixture(t)
	f.trade(t, "AAPL", 10, 13, time.Date(2026, 9, 29, 10, 0, 0, 0, f.ny)) // +300
	f.trade(t, "MSFT", 20, 19, time.Date(2026, 10, 1, 14, 0, 0, 0, f.ny)) // -100
	// Closed Sunday 23:30 NY the week before — Monday 03:30 UTC, not this week.
	f.trade(t, "TSLA", 10, 20, time.Date(2026, 9, 27, 23, 30, 0, 0, f.ny))

	// Saturday 08:59 NY (12:59 UTC): not due yet.
	f.run(t, time.Date(2026, 10, 3, 12, 59, 0, 0, time.UTC))
	require.Empty(t, f.reviews(t))
	require.Empty(t, f.hook.payloads())

	// Saturday 09:00 NY: fires.
	f.run(t, time.Date(2026, 10, 3, 13, 0, 0, 0, time.UTC))
	notes := f.reviews(t)
	require.Len(t, notes, 1)
	note := notes[0]
	require.Equal(t, "Week of Sep 28 – Oct 4", note.Title)
	require.Equal(t, "2026-10-03", note.OccurredAt)
	require.Contains(t, note.Body, "- Net P&L: +$200.00")
	require.Contains(t, note.Body, "- Trades: 2 (1 won, 1 lost)")
	require.Contains(t, note.Body, "- Win rate: 50.0%")
	require.Contains(t, note.Body, "## Focus for next week")

	got := f.hook.payloads()
	require.Len(t, got, 1)
	require.Equal(t, "weekly_review", got[0]["rule"])
	require.Equal(t, "Weekly review: Sep 28 – Oct 4", got[0]["title"])
	require.Equal(t, "+$200.00 on 2 trades, 50.0% win rate. Tap to write your review.", got[0]["body"])
	data, ok := got[0]["data"].(map[string]any)
	require.True(t, ok, "webhook payload carries data: %v", got[0])
	require.Equal(t, note.ID, data["note_id"])
	require.Equal(t, "/edit-note?id="+note.ID, data["route"])

	// Later runs the same weekend — each a fresh service, as after a
	// restart — neither re-send nor create another note.
	f.run(t, time.Date(2026, 10, 3, 14, 0, 0, 0, time.UTC))
	f.run(t, time.Date(2026, 10, 5, 3, 0, 0, 0, time.UTC)) // Sunday 23:00 NY
	require.Len(t, f.reviews(t), 1)
	require.Len(t, f.hook.payloads(), 1)

	// History lists it once.
	events, err := f.q.ListAlertEvents(context.Background(), store.ListAlertEventsParams{UserID: f.userID, Limit: 10})
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.Equal(t, alerts.RuleWeeklyReview, events[0].Rule)

	// The next week fires again, into its own note.
	f.run(t, time.Date(2026, 10, 10, 13, 0, 0, 0, time.UTC))
	require.Len(t, f.reviews(t), 2)
	require.Len(t, f.hook.payloads(), 2)
}

func TestWeeklyReviewZeroTradeWeek(t *testing.T) {
	f := newWeeklyFixture(t)
	f.run(t, time.Date(2026, 10, 3, 13, 0, 0, 0, time.UTC))
	notes := f.reviews(t)
	require.Len(t, notes, 1)
	require.Contains(t, notes[0].Body, "- Net P&L: $0.00")
	require.Contains(t, notes[0].Body, "- Trades: 0 (0 won, 0 lost)")
	require.NotContains(t, notes[0].Body, "—")
	got := f.hook.payloads()
	require.Len(t, got, 1)
	require.Equal(t, "No trades this week. Tap to write your review.", got[0]["body"])
}

func TestWeeklyReviewReusesNoteAfterInterruptedRun(t *testing.T) {
	f := newWeeklyFixture(t)
	ctx := context.Background()
	// A run that created the note and died before marking the week sent.
	note, err := f.q.CreateJournalNote(ctx, store.CreateJournalNoteParams{
		ID: uuid.New().String(), UserID: f.userID, OccurredAt: "2026-10-03",
		Title: "Week of Sep 28 – Oct 4", Body: "half-written", Symbols: "[]",
		NoteType: alerts.NoteTypeWeeklyReview,
	})
	require.NoError(t, err)
	require.NoError(t, f.q.UpsertWeeklyReviewNote(ctx, store.UpsertWeeklyReviewNoteParams{
		UserID: f.userID, WeekStart: "2026-09-28", NoteID: note.ID,
	}))

	f.run(t, time.Date(2026, 10, 3, 13, 30, 0, 0, time.UTC))
	notes := f.reviews(t)
	require.Len(t, notes, 1, "the interrupted run's note is reused")
	require.Equal(t, "half-written", notes[0].Body, "an existing note is never overwritten")
	got := f.hook.payloads()
	require.Len(t, got, 1)
	require.Equal(t, note.ID, got[0]["data"].(map[string]any)["note_id"])

	row, err := f.q.GetWeeklyReview(ctx, store.GetWeeklyReviewParams{UserID: f.userID, WeekStart: "2026-09-28"})
	require.NoError(t, err)
	require.True(t, row.SentAt.Valid)
}

func TestWeeklyReviewRecreatesDeletedNote(t *testing.T) {
	f := newWeeklyFixture(t)
	ctx := context.Background()
	require.NoError(t, f.q.UpsertWeeklyReviewNote(ctx, store.UpsertWeeklyReviewNoteParams{
		UserID: f.userID, WeekStart: "2026-09-28", NoteID: "gone",
	}))
	f.run(t, time.Date(2026, 10, 3, 13, 30, 0, 0, time.UTC))
	notes := f.reviews(t)
	require.Len(t, notes, 1)
	require.NotEqual(t, "gone", notes[0].ID)
}

func TestWeeklyReviewRespectsToggles(t *testing.T) {
	ctx := context.Background()
	sat := time.Date(2026, 10, 3, 13, 0, 0, 0, time.UTC)

	f := newWeeklyFixture(t)
	cur, err := f.q.GetAlertSettings(ctx, f.userID)
	require.NoError(t, err)
	require.EqualValues(t, 1, cur.RuleWeeklyReview, "weekly review defaults on")
	_, err = f.q.UpsertAlertSettings(ctx, store.UpsertAlertSettingsParams{
		UserID: f.userID, Enabled: 1, LossStreakN: 3, PropWarnPct: 0.8, UnreviewedDays: 7,
		RuleWeeklyReview: 0,
	})
	require.NoError(t, err)
	f.run(t, sat)
	require.Empty(t, f.reviews(t), "toggle off")

	g := newWeeklyFixture(t)
	_, err = g.q.UpsertAlertSettings(ctx, store.UpsertAlertSettingsParams{
		UserID: g.userID, Enabled: 0, LossStreakN: 3, PropWarnPct: 0.8, UnreviewedDays: 7,
		RuleWeeklyReview: 1,
	})
	require.NoError(t, err)
	g.run(t, sat)
	require.Empty(t, g.reviews(t), "alerts off")
}

func TestWeeklyReviewFallsBackToNewYork(t *testing.T) {
	f := newWeeklyFixture(t)
	_, err := f.q.UpsertUserPreferences(context.Background(), store.UpsertUserPreferencesParams{
		UserID: f.userID, Prefs: `{}`,
	})
	require.NoError(t, err)
	// 12:59 UTC is 08:59 in New York — still too early without a synced zone.
	f.run(t, time.Date(2026, 10, 3, 12, 59, 0, 0, time.UTC))
	require.Empty(t, f.reviews(t))
	f.run(t, time.Date(2026, 10, 3, 13, 0, 0, 0, time.UTC))
	require.Len(t, f.reviews(t), 1)
}

func TestWeeklyReviewHongKongMarket(t *testing.T) {
	f := newWeeklyFixture(t)
	_, err := f.q.UpsertUserPreferences(context.Background(), store.UpsertUserPreferencesParams{
		UserID: f.userID, Prefs: `{"marketTimezone":"Asia/Hong_Kong"}`,
	})
	require.NoError(t, err)
	// Saturday 09:00 HKT is 01:00 UTC.
	f.run(t, time.Date(2026, 10, 3, 0, 59, 0, 0, time.UTC))
	require.Empty(t, f.reviews(t))
	f.run(t, time.Date(2026, 10, 3, 1, 0, 0, 0, time.UTC))
	notes := f.reviews(t)
	require.Len(t, notes, 1)
	require.True(t, strings.HasPrefix(notes[0].Title, "Week of Sep 28"))
}
