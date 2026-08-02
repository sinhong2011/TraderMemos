package econdata

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

type fakeProvider struct {
	events []Event
	calls  int
}

func (p *fakeProvider) Name() string { return "fake" }

func (p *fakeProvider) FetchEvents(ctx context.Context) ([]Event, error) {
	p.calls++
	return p.events, nil
}

func newTestStore(t *testing.T) store.Querier {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	t.Cleanup(func() { _ = conn.Close() })
	return store.New(conn)
}

func listAll(t *testing.T, q store.Querier) []store.EconomicEvent {
	t.Helper()
	rows, err := q.ListEconomicEvents(context.Background(), store.ListEconomicEventsParams{
		EventTs:   "2000-01-01T00:00:00Z",
		EventTs_2: "2100-01-01T00:00:00Z",
	})
	require.NoError(t, err)
	return rows
}

func TestEnsureFreshInsertsAndHonorsTTL(t *testing.T) {
	q := newTestStore(t)
	future := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)
	p := &fakeProvider{events: []Event{
		{Title: "CPI y/y", Country: "USD", Impact: "high", Time: future, Forecast: "2.9%"},
		{Title: "GDP q/q", Country: "EUR", Impact: "medium", Time: future.Add(time.Hour)},
	}}
	s := NewService(q, p)

	require.NoError(t, s.EnsureFresh(context.Background()))
	require.Equal(t, 1, p.calls)
	require.Len(t, listAll(t, q), 2)

	// Within TTL: no second fetch.
	require.NoError(t, s.EnsureFresh(context.Background()))
	require.Equal(t, 1, p.calls)
}

func TestEnsureFreshReplacesRescheduledFutureEvents(t *testing.T) {
	q := newTestStore(t)
	future := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)
	p := &fakeProvider{events: []Event{
		{Title: "Rate Decision", Country: "GBP", Impact: "high", Time: future},
	}}
	s := NewService(q, p)
	s.TTL = time.Nanosecond // every EnsureFresh refetches

	require.NoError(t, s.EnsureFresh(context.Background()))

	// The event gets rescheduled two hours later upstream.
	p.events[0].Time = future.Add(2 * time.Hour)
	require.NoError(t, s.EnsureFresh(context.Background()))

	rows := listAll(t, q)
	require.Len(t, rows, 1)
	require.Equal(t, future.Add(2*time.Hour).Format(time.RFC3339), rows[0].EventTs)
}

func TestEnsureFreshKeepsPastRowsAndSurvivesEmptyFeed(t *testing.T) {
	q := newTestStore(t)
	past := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Second)
	future := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)

	// Historical row from an earlier week, no longer in the feed.
	require.NoError(t, q.UpsertEconomicEvent(context.Background(), store.UpsertEconomicEventParams{
		Provider: "fake", Title: "NFP", Country: "USD", Impact: "high",
		EventTs:   past.Format(time.RFC3339),
		FetchedAt: past.Format(time.RFC3339),
	}))

	p := &fakeProvider{events: []Event{
		{Title: "CPI y/y", Country: "USD", Impact: "high", Time: future},
	}}
	s := NewService(q, p)
	s.TTL = time.Nanosecond

	require.NoError(t, s.EnsureFresh(context.Background()))
	require.Len(t, listAll(t, q), 2)

	// A feed hiccup returning [] must not wipe anything.
	p.events = nil
	require.NoError(t, s.EnsureFresh(context.Background()))
	require.Len(t, listAll(t, q), 2)
}
