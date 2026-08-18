package flexsync_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/flexsync"
	"github.com/tradermemos/api/internal/store"
)

const flexCSV = "ClientAccountID,Symbol,Buy/Sell,Quantity,TradePrice,DateTime,IBCommission,AssetClass,Multiplier,Put/Call\n" +
	"U1234567,AAPL,BUY,100,10,20260730;093000,-1.00,STK,1,\n" +
	"U1234567,AAPL,SELL,-100,12,20260730;100000,-1.00,STK,1,\n" +
	"U1234567,MU 260817C01030000,BUY,5,3.84,20260731;094500,-1.42,OPT,100,C\n"

// flexServer fakes IBKR's two-step Flex Web Service: SendRequest hands out a
// reference, GetStatement reports "in progress" pendingCount times, then
// serves the CSV.
type flexServer struct {
	*httptest.Server
	pendingLeft atomic.Int32
	statements  atomic.Int32
}

func newFlexServer(t *testing.T, pending int) *flexServer {
	t.Helper()
	fs := &flexServer{}
	fs.pendingLeft.Store(int32(pending))
	mux := http.NewServeMux()
	mux.HandleFunc("/send", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "tok123", r.URL.Query().Get("t"))
		require.Equal(t, "q42", r.URL.Query().Get("q"))
		fmt.Fprintf(w, `<FlexStatementResponse timestamp="x"><Status>Success</Status><ReferenceCode>REF9</ReferenceCode><Url>%s/get</Url></FlexStatementResponse>`, fs.URL)
	})
	mux.HandleFunc("/get", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "REF9", r.URL.Query().Get("q"))
		if fs.pendingLeft.Add(-1) >= 0 {
			fmt.Fprint(w, `<FlexStatementResponse><Status>Warn</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress. Please try again shortly.</ErrorMessage></FlexStatementResponse>`)
			return
		}
		fs.statements.Add(1)
		fmt.Fprint(w, flexCSV)
	})
	fs.Server = httptest.NewServer(mux)
	t.Cleanup(fs.Close)
	return fs
}

func (fs *flexServer) client() *flexsync.Client {
	return &flexsync.Client{
		BaseURL:      fs.URL + "/send",
		PollInterval: time.Millisecond,
		PollAttempts: 5,
	}
}

func TestClientFetchStatementPollsUntilReady(t *testing.T) {
	fs := newFlexServer(t, 2)
	data, err := fs.client().FetchStatement(context.Background(), "tok123", "q42")
	require.NoError(t, err)
	require.Equal(t, flexCSV, string(data))
	require.EqualValues(t, 1, fs.statements.Load())
}

func TestClientReportsFlexErrors(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/send", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `<FlexStatementResponse><Status>Fail</Status><ErrorCode>1012</ErrorCode><ErrorMessage>Token has expired.</ErrorMessage></FlexStatementResponse>`)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c := &flexsync.Client{BaseURL: srv.URL + "/send", PollInterval: time.Millisecond}
	_, err := c.FetchStatement(context.Background(), "tok", "q")
	require.ErrorContains(t, err, "Token has expired")
}

func newSyncFixture(t *testing.T) (*store.Queries, store.FlexSyncSetting) {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: "f@x.com", PasswordHash: "x"})
	require.NoError(t, err)
	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "IB",
		Broker: "ibkr", AccountType: "margin", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)
	settings, err := q.UpsertFlexSyncSettings(ctx, store.UpsertFlexSyncSettingsParams{
		AccountID: acc.ID, UserID: u.ID, Token: "tok123", QueryID: "q42", Enabled: 1,
	})
	require.NoError(t, err)
	return q, settings
}

func TestSyncImportsAndDedups(t *testing.T) {
	q, settings := newSyncFixture(t)
	fs := newFlexServer(t, 0)
	ctx := context.Background()

	res, err := flexsync.Sync(ctx, q, fs.client(), settings)
	require.NoError(t, err)
	require.Equal(t, 3, res.Inserted)
	require.Equal(t, 0, res.Skipped)

	trades, err := q.ListTrades(ctx, store.ListTradesParams{UserID: settings.UserID, AccountID: settings.AccountID})
	require.NoError(t, err)
	require.Len(t, trades, 2)
	bySymbol := map[string]store.Trade{}
	for _, tr := range trades {
		bySymbol[tr.Symbol] = tr
	}
	aapl := bySymbol["AAPL"]
	require.Equal(t, "closed", aapl.Status)
	require.InDelta(t, 198, aapl.NetPnl.Float64, 0.01) // (12−10)×100 − $2 commission

	// The OCC option symbol is normalized to underlying + contract details.
	mu, ok := bySymbol["MU"]
	require.True(t, ok, "expected an MU trade, got %v", trades)
	require.Equal(t, "open", mu.Status)
	fills, err := q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{
		UserID: settings.UserID, AccountID: settings.AccountID,
	})
	require.NoError(t, err)
	var optDetails string
	for _, f := range fills {
		if f.InstrumentType == "option" {
			optDetails = f.Details.String
		}
	}
	require.Contains(t, optDetails, `"strike":"1030"`)
	require.Contains(t, optDetails, `"expiry":"2026-08-17"`)
	require.Contains(t, optDetails, `"option_right":"call"`)

	// Second sync of the same statement: everything is a duplicate.
	res2, err := flexsync.Sync(ctx, q, fs.client(), settings)
	require.NoError(t, err)
	require.Equal(t, 0, res2.Inserted)
	require.Equal(t, 3, res2.Skipped)

	// Both runs left committed batches for history.
	batches, err := q.ListImportBatches(ctx, settings.UserID)
	require.NoError(t, err)
	require.Len(t, batches, 2)
	for _, b := range batches {
		require.Equal(t, "committed", b.Status)
		require.Equal(t, "ibkr-flex-sync", b.Source)
	}
}

func TestSyncRejectsNonIBKRStatement(t *testing.T) {
	q, settings := newSyncFixture(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/send", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `<FlexStatementResponse><Status>Success</Status><ReferenceCode>R</ReferenceCode><Url>%s/get</Url></FlexStatementResponse>`, "http://"+r.Host)
	})
	mux.HandleFunc("/get", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "some,other,columns\n1,2,3\n")
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c := &flexsync.Client{BaseURL: srv.URL + "/send", PollInterval: time.Millisecond}
	_, err := flexsync.Sync(context.Background(), q, c, settings)
	require.ErrorContains(t, err, "Trades → Executions")
}

func TestRecordOutcome(t *testing.T) {
	q, settings := newSyncFixture(t)
	ctx := context.Background()

	flexsync.RecordOutcome(ctx, q, settings, flexsync.Result{Inserted: 3, Skipped: 1, Rows: 4}, nil)
	row, err := q.GetFlexSyncSettings(ctx, store.GetFlexSyncSettingsParams{AccountID: settings.AccountID, UserID: settings.UserID})
	require.NoError(t, err)
	require.True(t, row.LastSyncedAt.Valid)
	require.Contains(t, row.LastStatus, "3 new")
	require.Empty(t, row.LastError)

	flexsync.RecordOutcome(ctx, q, settings, flexsync.Result{}, fmt.Errorf("token expired"))
	row, err = q.GetFlexSyncSettings(ctx, store.GetFlexSyncSettingsParams{AccountID: settings.AccountID, UserID: settings.UserID})
	require.NoError(t, err)
	require.Equal(t, "error", row.LastStatus)
	require.Equal(t, "token expired", row.LastError)
}
