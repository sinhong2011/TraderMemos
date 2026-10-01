package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type missedJSON struct {
	ID        string   `json:"id"`
	Symbol    string   `json:"symbol"`
	AccountID *string  `json:"account_id"`
	SetupID   *string  `json:"setup_id"`
	Outcome   string   `json:"outcome"`
	PlannedR  *float64 `json:"planned_r"`
	R         *float64 `json:"r"`
}

func TestMissedTradesLifecycleAndSummary(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "missed@example.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var setup struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))

	create := func(body string) missedJSON {
		rec := do(s, http.MethodPost, "/api/v1/missed-trades", body, tok)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return decode[missedJSON](t, rec.Body.Bytes())
	}
	orb := create(`{"symbol":" nvda ","direction":"long","observed_at":"2026-09-29T14:00:00Z",` +
		`"entry":100,"stop":98,"target":105,"reason":"hesitated","outcome":"target",` +
		`"account_id":"` + acc + `","setup_id":"` + setup.ID + `"}`)
	require.Equal(t, "NVDA", orb.Symbol)
	require.InDelta(t, 2.5, *orb.PlannedR, 1e-9)
	require.InDelta(t, 2.5, *orb.R, 1e-9)

	stopped := create(`{"symbol":"TSLA","direction":"short","observed_at":"2026-09-30T15:00:00Z",` +
		`"entry":200,"stop":204,"target":190,"reason":"hesitated","outcome":"stop"}`)
	require.InDelta(t, -1.0, *stopped.R, 1e-9)
	unknown := create(`{"symbol":"AAPL","direction":"long","observed_at":"2026-08-01T15:00:00Z","reason":"away"}`)
	require.Equal(t, "unknown", unknown.Outcome)
	require.Nil(t, unknown.PlannedR)
	require.Nil(t, unknown.R)

	for _, bad := range []string{
		`{"symbol":"","direction":"long","observed_at":"2026-09-29T14:00:00Z"}`,
		`{"symbol":"X","direction":"up","observed_at":"2026-09-29T14:00:00Z"}`,
		`{"symbol":"X","direction":"long"}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","outcome":"won"}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","reason":"lazy"}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","entry":100,"stop":101,"target":105}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","entry":-1}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","setup_id":"nope"}`,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z","account_id":"nope"}`,
	} {
		rec := do(s, http.MethodPost, "/api/v1/missed-trades", bad, tok)
		require.Equal(t, http.StatusBadRequest, rec.Code, bad)
	}

	rec = do(s, http.MethodGet, "/api/v1/missed-trades", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	list := decode[[]missedJSON](t, rec.Body.Bytes())
	require.Len(t, list, 3)
	require.Equal(t, "TSLA", list[0].Symbol, "newest first")

	// Filters: account scope keeps only misses tagged to that account; dates bound observed_at.
	rec = do(s, http.MethodGet, "/api/v1/missed-trades?account_id="+acc, "", tok)
	require.Len(t, decode[[]missedJSON](t, rec.Body.Bytes()), 1)
	rec = do(s, http.MethodGet, "/api/v1/missed-trades?from=2026-09-01T00:00:00Z", "", tok)
	require.Len(t, decode[[]missedJSON](t, rec.Body.Bytes()), 2)

	rec = do(s, http.MethodGet, "/api/v1/missed-trades/summary", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var sum struct {
		Count    int     `json:"count"`
		Scored   int     `json:"scored"`
		RLeft    float64 `json:"r_left"`
		RAvoided float64 `json:"r_avoided"`
		NetR     float64 `json:"net_r"`
		ByReason []struct {
			Key   string  `json:"key"`
			Count int     `json:"count"`
			NetR  float64 `json:"net_r"`
		} `json:"by_reason"`
		BySetup []struct {
			Key  string  `json:"key"`
			NetR float64 `json:"net_r"`
		} `json:"by_setup"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sum))
	require.Equal(t, 3, sum.Count)
	require.Equal(t, 2, sum.Scored)
	require.InDelta(t, 2.5, sum.RLeft, 1e-9)
	require.InDelta(t, 1.0, sum.RAvoided, 1e-9)
	require.InDelta(t, 1.5, sum.NetR, 1e-9)
	require.Equal(t, "hesitated", sum.ByReason[0].Key)
	require.Equal(t, 2, sum.ByReason[0].Count)
	require.Len(t, sum.BySetup, 1)
	require.Equal(t, setup.ID, sum.BySetup[0].Key)

	// Filling in the outcome later reprices it.
	rec = do(s, http.MethodPut, "/api/v1/missed-trades/"+unknown.ID,
		`{"symbol":"AAPL","direction":"long","observed_at":"2026-08-01T15:00:00Z","reason":"away",`+
			`"entry":10,"stop":9,"target":13,"outcome":"target"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.InDelta(t, 3.0, *decode[missedJSON](t, rec.Body.Bytes()).R, 1e-9)

	require.Equal(t, http.StatusNoContent, do(s, http.MethodDelete, "/api/v1/missed-trades/"+stopped.ID, "", tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodDelete, "/api/v1/missed-trades/"+stopped.ID, "", tok).Code)

	// Misses never reach trade stats.
	rec = do(s, http.MethodGet, "/api/v1/analytics/summary", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var tradeSum struct {
		TotalTrades int `json:"total_trades"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tradeSum))
	require.Equal(t, 0, tradeSum.TotalTrades)
}

func TestMissedTradesAreScopedToTheirOwner(t *testing.T) {
	s := testServer(t)
	a := registerAndLogin(t, s, "missed-a@example.com")
	b := registerAndLogin(t, s, "missed-b@example.com")
	rec := do(s, http.MethodPost, "/api/v1/missed-trades",
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z"}`, a)
	require.Equal(t, http.StatusCreated, rec.Code)
	id := decode[missedJSON](t, rec.Body.Bytes()).ID

	rec = do(s, http.MethodGet, "/api/v1/missed-trades", "", b)
	require.Equal(t, "[]", rec.Body.String()[:2])
	require.Equal(t, http.StatusNotFound, do(s, http.MethodPut, "/api/v1/missed-trades/"+id,
		`{"symbol":"X","direction":"long","observed_at":"2026-09-29T14:00:00Z"}`, b).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodDelete, "/api/v1/missed-trades/"+id, "", b).Code)
}
