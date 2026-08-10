package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func writeTempConfig(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".tm-sync.toml")
	require.NoError(t, os.WriteFile(path, []byte(body), 0o600))
	return path
}

func TestLoadConfigValidates(t *testing.T) {
	dir := t.TempDir()
	good := writeTempConfig(t, `
api_url = "http://localhost:8787"
token = "tm_pat_x"
account_id = "acc-1"
[[watch]]
dir = '`+dir+`'
source_tz = "Europe/Athens"
`)
	cfg, err := loadConfig(good)
	require.NoError(t, err)
	require.Equal(t, "acc-1", cfg.AccountID)
	require.Len(t, cfg.Watch, 1)
	require.Equal(t, "Europe/Athens", cfg.Watch[0].SourceTZ)

	for name, body := range map[string]string{
		"missing token": `api_url = "x"` + "\n" + `account_id = "a"` + "\n[[watch]]\ndir = '/x'",
		"missing watch": `api_url = "x"` + "\n" + `token = "t"` + "\n" + `account_id = "a"`,
		"bad tz": `api_url = "x"
token = "t"
account_id = "a"
[[watch]]
dir = '/x'
source_tz = "EET/Wrong"`,
	} {
		_, err := loadConfig(writeTempConfig(t, body))
		require.Error(t, err, name)
	}
}

func TestWriteSampleConfigRefusesOverwrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".tm-sync.toml")
	require.NoError(t, writeSampleConfig(path))
	info, err := os.Stat(path)
	require.NoError(t, err)
	if os.Getenv("GOOS") != "windows" {
		require.Equal(t, os.FileMode(0o600), info.Mode().Perm()) // config holds the PAT
	}
	require.Error(t, writeSampleConfig(path))
}

// fakeServer mimics the two endpoints tm-sync uses, counting inserts and
// replaying the real dedup response shape for repeated fills.
type fakeServer struct {
	t        *testing.T
	accounts []apiAccount
	seen     map[string]bool
	inserted int
	deduped  int
	lots     []string
}

func (f *fakeServer) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tm_pat_test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(f.accounts)
	})
	mux.HandleFunc("POST /api/v1/executions", func(w http.ResponseWriter, r *http.Request) {
		var in createExecutionReq
		require.NoError(f.t, json.NewDecoder(r.Body).Decode(&in))
		if lot := in.Details["lot"]; lot != "" {
			f.lots = append(f.lots, lot)
		}
		key := in.Symbol + in.Side + in.ExecutedAt.String()
		if f.seen[key] {
			f.deduped++
			_ = json.NewEncoder(w).Encode(map[string]string{"deduped": "true"})
			return
		}
		f.seen[key] = true
		f.inserted++
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"execution_id": "e", "trade_id": "t"})
	})
	return mux
}

func newFakeServer(t *testing.T) (*fakeServer, *httptest.Server) {
	f := &fakeServer{t: t, seen: map[string]bool{}, accounts: []apiAccount{{ID: "acc-1", Name: "Main"}}}
	srv := httptest.NewServer(f.handler())
	t.Cleanup(srv.Close)
	return f, srv
}

func TestCheckAccount(t *testing.T) {
	_, srv := newFakeServer(t)
	require.NoError(t, newClient(srv.URL, "tm_pat_test").CheckAccount(context.Background(), "acc-1"))

	err := newClient(srv.URL, "tm_pat_test").CheckAccount(context.Background(), "nope")
	require.ErrorContains(t, err, "Main (acc-1)")

	err = newClient(srv.URL, "tm_pat_wrong").CheckAccount(context.Background(), "acc-1")
	require.ErrorContains(t, err, "authentication failed")
}

// A minimal MT4 statement: one closed EURUSD round-trip.
const mt4Statement = `<html><body><table>
<tr><td colspan="14">Closed Transactions:</td></tr>
<tr><td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td><td>Price</td><td>S / L</td><td>T / P</td><td>Close Time</td><td>Price</td><td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td></tr>
<tr><td>91</td><td>2024.01.08 09:15:00</td><td>buy</td><td>0.20</td><td>eurusd</td><td>1.09312</td><td>0</td><td>0</td><td>2024.01.09 16:30:00</td><td>1.09501</td><td>-2.00</td><td>0.00</td><td>-0.85</td><td>36.20</td></tr>
<tr><td colspan="10"></td><td>Closed P/L:</td><td colspan="3">36.20</td></tr>
</table></body></html>`

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestScanOnceSyncsAndIsIdempotent(t *testing.T) {
	f, srv := newFakeServer(t)
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "statement.html"), []byte(mt4Statement), 0o644))
	// Non-statement noise is skipped silently.
	require.NoError(t, os.WriteFile(filepath.Join(dir, "notes.html"), []byte("<html><table><tr><td>x</td></tr></table></html>"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("hi"), 0o644))

	cfg := Config{
		APIURL: srv.URL, Token: "tm_pat_test", AccountID: "acc-1",
		Watch: []WatchRule{{Dir: dir}},
	}
	sy := newSyncer(cfg, newClient(srv.URL, "tm_pat_test"), testLogger())
	require.NoError(t, sy.ScanOnce(context.Background()))
	require.Equal(t, 2, f.inserted) // open + close fill pair
	require.Equal(t, 0, f.deduped)
	require.Equal(t, []string{"mt4-91", "mt4-91"}, f.lots)

	// Unchanged file: stamped, nothing re-posted.
	require.NoError(t, sy.ScanOnce(context.Background()))
	require.Equal(t, 2, f.inserted)
	require.Equal(t, 0, f.deduped)

	// A fresh syncer (process restart) replays the file; the server dedups.
	sy2 := newSyncer(cfg, newClient(srv.URL, "tm_pat_test"), testLogger())
	require.NoError(t, sy2.ScanOnce(context.Background()))
	require.Equal(t, 2, f.inserted)
	require.Equal(t, 2, f.deduped)
}

func TestScanLeavesFileUnstampedOnServerError(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "statement.html"), []byte(mt4Statement), 0o644))

	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	cfg := Config{APIURL: srv.URL, Token: "tm_pat_test", AccountID: "acc-1", Watch: []WatchRule{{Dir: dir}}}
	sy := newSyncer(cfg, newClient(srv.URL, "tm_pat_test"), testLogger())
	require.Error(t, sy.ScanOnce(context.Background()))
	firstCalls := calls
	// Not stamped — the next scan retries the same file.
	require.Error(t, sy.ScanOnce(context.Background()))
	require.Greater(t, calls, firstCalls)
}

func TestWatchPicksUpNewStatement(t *testing.T) {
	f, srv := newFakeServer(t)
	dir := t.TempDir()
	cfg := Config{APIURL: srv.URL, Token: "tm_pat_test", AccountID: "acc-1", Watch: []WatchRule{{Dir: dir}}}
	sy := newSyncer(cfg, newClient(srv.URL, "tm_pat_test"), testLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- sy.Watch(ctx) }()

	// Give the watcher a moment to register, then drop a statement in.
	time.Sleep(300 * time.Millisecond)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "new-report.html"), []byte(mt4Statement), 0o644))

	require.Eventually(t, func() bool {
		sy.mu.Lock()
		defer sy.mu.Unlock()
		return len(sy.seen) == 1
	}, 15*time.Second, 100*time.Millisecond, "watcher should sync the new file")
	require.Equal(t, 2, f.inserted)

	cancel()
	require.ErrorIs(t, <-done, context.Canceled)
}
