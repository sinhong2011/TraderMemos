package jobs_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/jobs"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// barProvider serves synthetic 1-minute bars across any requested window and
// counts fetches; fail makes every fetch error (provider outage).
type barProvider struct {
	fetches int
	fail    bool
}

func (p *barProvider) Name() string { return "test" }

func (p *barProvider) FetchBars(_ context.Context, req marketdata.Request) ([]marketdata.Bar, error) {
	p.fetches++
	if p.fail {
		return nil, errors.New("provider down")
	}
	var bars []marketdata.Bar
	for ts := req.From; !ts.After(req.To); ts = ts.Add(time.Minute) {
		bars = append(bars, marketdata.Bar{
			Time: ts.Unix(), Open: 10, High: 13, Low: 9, Close: 12, Volume: 1000,
		})
	}
	return bars, nil
}

// seedClosedTrade builds one closed round-trip (100 @ 10 → 12, 30-minute
// hold, opened two days ago) through the real grouping engine.
func seedClosedTrade(t *testing.T, q *store.Queries, symbol string) (userID, tradeID string) {
	t.Helper()
	ctx := context.Background()
	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: uuid.NewString() + "@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "Main",
		Broker: "manual", AccountType: "margin", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)

	opened := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Minute)
	for i, leg := range []struct {
		side  string
		price float64
		at    time.Time
	}{
		{"buy", 10, opened},
		{"sell", 12, opened.Add(30 * time.Minute)},
	} {
		_, err := q.InsertExecution(ctx, store.InsertExecutionParams{
			ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID,
			Symbol: symbol, InstrumentType: "stock", Side: leg.side,
			Quantity: 100, Price: leg.price, ExecutedAt: leg.at, Multiplier: 1,
			DedupHash: uuid.NewString() + string(rune('a'+i)),
		})
		require.NoError(t, err)
	}
	require.NoError(t, trades.NewService(q).Regroup(ctx, u.ID, acc.ID))

	rows, err := q.ListTradesMissingExcursion(ctx, 10)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	return u.ID, rows[0].ID
}

func newBackfillFixture(t *testing.T) (*store.Queries, *barProvider, *marketdata.Service) {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	provider := &barProvider{}
	return q, provider, marketdata.NewService(q, provider)
}

func TestExcursionBackfillFillsMissingMfe(t *testing.T) {
	q, _, market := newBackfillFixture(t)
	uid, tradeID := seedClosedTrade(t, q, "AAPL")

	job := jobs.NewExcursionBackfill(q, market, time.Hour, 5, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	require.NoError(t, job.Run(context.Background()))

	j, err := q.GetTradeJournal(context.Background(), store.GetTradeJournalParams{TradeID: tradeID, UserID: uid})
	require.NoError(t, err)
	require.True(t, j.Mfe.Valid)
	require.InDelta(t, 300, j.Mfe.Float64, 0.01) // (13 − 10) × 100 at the bar high
	require.True(t, j.Mae.Valid)
	require.InDelta(t, 100, j.Mae.Float64, 0.01) // (10 − 9) × 100 at the bar low

	// Nothing left to backfill.
	rows, err := q.ListTradesMissingExcursion(context.Background(), 10)
	require.NoError(t, err)
	require.Empty(t, rows)
}

func TestExcursionBackfillSkipsUncomputableOnce(t *testing.T) {
	q, provider, market := newBackfillFixture(t)
	// ChartableSymbol rejects E2E-prefixed fixtures, so this trade is
	// permanently uncomputable.
	seedClosedTrade(t, q, "E2EFAKE")

	job := jobs.NewExcursionBackfill(q, market, time.Hour, 5, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	require.NoError(t, job.Run(context.Background()))
	require.Zero(t, provider.fetches, "unchartable symbol must not hit the provider")

	// Second run must not retry the blacklisted trade.
	require.NoError(t, job.Run(context.Background()))
	require.Zero(t, provider.fetches)
}

func TestExcursionBackfillAbortsOnProviderOutage(t *testing.T) {
	q, provider, market := newBackfillFixture(t)
	uid, tradeID := seedClosedTrade(t, q, "AAPL")
	provider.fail = true

	job := jobs.NewExcursionBackfill(q, market, time.Hour, 5, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	require.Error(t, job.Run(context.Background()))

	// The trade stays pending (not blacklisted) for the next tick.
	provider.fail = false
	require.NoError(t, job.Run(context.Background()))
	j, err := q.GetTradeJournal(context.Background(), store.GetTradeJournalParams{TradeID: tradeID, UserID: uid})
	require.NoError(t, err)
	require.True(t, j.Mfe.Valid)
}
