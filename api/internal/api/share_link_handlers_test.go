package api_test

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// shareTestServer is testServer with share links switched on — the shipped
// default is off, which TestShareLinksDisabled pins.
func shareTestServer(t *testing.T) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.NewForDriver(conn, "sqlite")
	j := auth.NewJWT("test")
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
		ShareLinksEnabled: true,
	})
}

// seedShareClosedTrade books a round trip on symbol for net P&L (sell-buy)*qty.
func seedShareClosedTrade(t *testing.T, s *api.Server, tok, acc, symbol, day string, buy, sell float64) {
	t.Helper()
	b := `{"account_id":"` + acc + `","symbol":"` + symbol + `","instrument_type":"stock","side":"buy","quantity":10,"price":` + jsonNum(buy) + `,"executed_at":"` + day + `T10:00:00Z"}`
	sl := `{"account_id":"` + acc + `","symbol":"` + symbol + `","instrument_type":"stock","side":"sell","quantity":10,"price":` + jsonNum(sell) + `,"executed_at":"` + day + `T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", b, tok).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sl, tok).Code)
}

func jsonNum(v float64) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func TestShareLinksDisabledByDefault(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "share-off@x.com")

	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, "/api/v1/share-links", "", tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodPost, "/api/v1/share-links", `{}`, tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, "/api/v1/public/share/sometoken", "", "").Code)
}

func TestShareLinkLifecycle(t *testing.T) {
	s := shareTestServer(t)
	tok := registerAndLogin(t, s, "share@x.com")
	acc := accountID(t, s, tok)
	seedShareClosedTrade(t, s, tok, acc, "AAPL", "2026-01-05", 10, 12) // +20
	seedShareClosedTrade(t, s, tok, acc, "MSFT", "2026-01-06", 100, 95) // -50

	rec := do(s, http.MethodPost, "/api/v1/share-links",
		`{"show_amounts":true,"currency":"USD"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var link struct {
		ID        string  `json:"id"`
		Token     string  `json:"token"`
		ExpiresAt *string `json:"expires_at"`
		Scope     struct {
			ShowAmounts bool `json:"show_amounts"`
		} `json:"scope"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &link))
	require.NotEmpty(t, link.Token)
	require.True(t, link.Scope.ShowAmounts)
	// Default expiry is 90 days out.
	require.NotNil(t, link.ExpiresAt)
	exp, err := time.Parse(time.RFC3339, *link.ExpiresAt)
	require.NoError(t, err)
	require.InDelta(t, 90*24, time.Until(exp).Hours(), 2)

	// The owner can re-read the token from the list.
	rec = do(s, http.MethodGet, "/api/v1/share-links", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.Equal(t, link.Token, list[0]["token"])

	// The public page needs no auth and carries the aggregate.
	rec = do(s, http.MethodGet, "/api/v1/public/share/"+link.Token, "", "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var pub map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &pub))
	summary := pub["summary"].(map[string]any)
	require.Equal(t, float64(2), summary["total_trades"])
	require.Equal(t, -30.0, summary["net_pnl"])
	require.Equal(t, "USD", pub["currency"])
	require.Equal(t, true, pub["show_amounts"])
	require.Len(t, pub["equity"].([]any), 2)
	require.Len(t, pub["top_symbols"].([]any), 2)

	// Views are counted.
	rec = do(s, http.MethodGet, "/api/v1/share-links", "", tok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Equal(t, float64(1), list[0]["view_count"])

	// Revoked answers the same 404 as never-existed, for owner and visitor.
	require.Equal(t, http.StatusNoContent, do(s, http.MethodDelete, "/api/v1/share-links/"+link.ID, "", tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodDelete, "/api/v1/share-links/"+link.ID, "", tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, "/api/v1/public/share/"+link.Token, "", "").Code)
}

func TestShareLinkRedactsAmounts(t *testing.T) {
	s := shareTestServer(t)
	tok := registerAndLogin(t, s, "redact@x.com")
	acc := accountID(t, s, tok)
	seedShareClosedTrade(t, s, tok, acc, "AAPL", "2026-01-05", 10, 12)

	rec := do(s, http.MethodPost, "/api/v1/share-links", `{"show_amounts":false}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var link struct {
		Token string `json:"token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &link))

	rec = do(s, http.MethodGet, "/api/v1/public/share/"+link.Token, "", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var pub map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &pub))
	require.Equal(t, false, pub["show_amounts"])
	require.NotContains(t, pub, "currency")
	summary := pub["summary"].(map[string]any)
	require.Equal(t, float64(1), summary["total_trades"])
	for _, k := range []string{"net_pnl", "avg_win", "largest_loss", "total_fees", "expectancy"} {
		require.NotContains(t, summary, k)
	}
	// Equity survives as shape only: single winning trade normalizes to 1.
	eq := pub["equity"].([]any)
	require.Len(t, eq, 1)
	require.Equal(t, 1.0, eq[0].(map[string]any)["value"])
}

func TestShareLinkScopeLimitsAccounts(t *testing.T) {
	s := shareTestServer(t)
	tok := registerAndLogin(t, s, "scoped@x.com")
	acc1 := accountID(t, s, tok)
	rec := do(s, http.MethodPost, "/api/v1/accounts",
		`{"name":"Second","base_currency":"USD","starting_balance":5000}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var acc2 struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &acc2))

	seedShareClosedTrade(t, s, tok, acc1, "AAPL", "2026-01-05", 10, 12)
	seedShareClosedTrade(t, s, tok, acc2.ID, "MSFT", "2026-01-06", 100, 95)

	rec = do(s, http.MethodPost, "/api/v1/share-links",
		`{"account_id":"`+acc1+`","show_amounts":true}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var link struct {
		Token string `json:"token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &link))

	rec = do(s, http.MethodGet, "/api/v1/public/share/"+link.Token, "", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var pub map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &pub))
	summary := pub["summary"].(map[string]any)
	require.Equal(t, float64(1), summary["total_trades"])
	syms := pub["top_symbols"].([]any)
	require.Len(t, syms, 1)
	require.Equal(t, "AAPL", syms[0].(map[string]any)["symbol"])
}

func TestShareLinkValidation(t *testing.T) {
	s := shareTestServer(t)
	tok := registerAndLogin(t, s, "valid@x.com")

	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodPost, "/api/v1/share-links", `{"expires_in_days":-1}`, tok).Code)
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodPost, "/api/v1/share-links", `{"expires_in_days":9999}`, tok).Code)
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodPost, "/api/v1/share-links", `{"from":"not-a-date"}`, tok).Code)
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodPost, "/api/v1/share-links", `{"tz":"Mars/Olympus"}`, tok).Code)
	require.Equal(t, http.StatusNotFound,
		do(s, http.MethodPost, "/api/v1/share-links", `{"account_id":"not-mine"}`, tok).Code)

	// 0 is the explicit "never expires" opt-out.
	rec := do(s, http.MethodPost, "/api/v1/share-links", `{"expires_in_days":0}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var link struct {
		ExpiresAt *string `json:"expires_at"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &link))
	require.Nil(t, link.ExpiresAt)
}

func TestShareLinkUserIsolation(t *testing.T) {
	s := shareTestServer(t)
	tokA := registerAndLogin(t, s, "owner@x.com")
	tokB := registerAndLogin(t, s, "other@x.com")

	rec := do(s, http.MethodPost, "/api/v1/share-links", `{}`, tokA)
	require.Equal(t, http.StatusCreated, rec.Code)
	var link struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &link))

	// B neither sees nor revokes A's link.
	rec = do(s, http.MethodGet, "/api/v1/share-links", "", tokB)
	require.Equal(t, http.StatusOK, rec.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 0)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodDelete, "/api/v1/share-links/"+link.ID, "", tokB).Code)

	// Unknown token 404s.
	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, "/api/v1/public/share/does-not-exist", "", "").Code)
}
