package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/econdata"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// testServerWithEcon wires the econ service against a stub feed server.
func testServerWithEcon(t *testing.T, feed http.HandlerFunc) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")

	srv := httptest.NewServer(feed)
	t.Cleanup(srv.Close)
	econ := econdata.NewService(q, econdata.NewFairEconomyProvider(srv.URL))

	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Econ: econ,
	})
}

func econFeedJSON(base time.Time) string {
	day := func(d int, hour int) string {
		return base.Add(time.Duration(d)*24*time.Hour + time.Duration(hour)*time.Hour).Format(time.RFC3339)
	}
	return fmt.Sprintf(`[
		{"title":"CPI y/y","country":"USD","date":%q,"impact":"High","forecast":"2.9%%","previous":"3.0%%"},
		{"title":"Unemployment Rate","country":"EUR","date":%q,"impact":"Medium","forecast":"6.2%%","previous":"6.3%%"},
		{"title":"Bank Holiday","country":"JPY","date":%q,"impact":"Holiday","forecast":"","previous":""}
	]`, day(1, 8), day(1, 10), day(2, 0))
}

func TestEconomicEventsRoundTrip(t *testing.T) {
	base := time.Now().UTC().Truncate(time.Hour)
	s := testServerWithEcon(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(econFeedJSON(base)))
	})
	tok := registerAndLogin(t, s, "econ@example.com")

	from := base.Format(time.RFC3339)
	to := base.Add(7 * 24 * time.Hour).Format(time.RFC3339)

	rec := do(s, http.MethodGet, "/api/v1/economic-events?from="+from+"&to="+to, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 3)
	require.Equal(t, "CPI y/y", out[0]["title"])
	require.Equal(t, "high", out[0]["impact"])
	require.Equal(t, "2.9%", out[0]["forecast"])

	// Impact + country filters.
	rec = do(s, http.MethodGet, "/api/v1/economic-events?from="+from+"&to="+to+"&impact=high,medium&country=usd", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 1)
	require.Equal(t, "USD", out[0]["country"])
}

func TestEconomicEventsServesCacheWhenFeedDown(t *testing.T) {
	base := time.Now().UTC().Truncate(time.Hour)
	feedDown := false
	s := testServerWithEcon(t, func(w http.ResponseWriter, r *http.Request) {
		if feedDown {
			http.Error(w, "boom", http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte(econFeedJSON(base)))
	})
	tok := registerAndLogin(t, s, "econ2@example.com")

	from := base.Format(time.RFC3339)
	to := base.Add(7 * 24 * time.Hour).Format(time.RFC3339)
	path := "/api/v1/economic-events?from=" + from + "&to=" + to

	rec := do(s, http.MethodGet, path, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)

	// Feed dies; cached rows still serve. (TTL keeps the request from even
	// hitting the feed, but a forced refresh must degrade, not 5xx.)
	feedDown = true
	rec = do(s, http.MethodGet, path, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var out []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 3)
}

func TestEconomicEventsValidation(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "econ3@example.com")

	rec := do(s, http.MethodGet, "/api/v1/economic-events?from=bogus&to=2026-08-10", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	rec = do(s, http.MethodGet, "/api/v1/economic-events?from=2026-08-10&to=2026-08-01", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// Date-only params are accepted; service not configured on testServer → 503.
	rec = do(s, http.MethodGet, "/api/v1/economic-events?from=2026-08-01&to=2026-08-10", "", tok)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}
