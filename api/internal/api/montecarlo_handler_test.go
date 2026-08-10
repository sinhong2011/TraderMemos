package api_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// seedRoundTrips posts n winning one-share round-trips a day apart.
func seedRoundTrips(t *testing.T, s *api.Server, tok, acc string, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		day := fmt.Sprintf("2026-01-%02d", i+1)
		buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":1,"price":10,"executed_at":"` + day + `T10:00:00Z"}`
		sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":1,"price":12,"executed_at":"` + day + `T11:00:00Z"}`
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, tok).Code)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, tok).Code)
	}
}

func TestMonteCarloEndpoint(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "montecarlo@x.com")
	acc := accountID(t, s, tok)
	seedRoundTrips(t, s, tok, acc, 12)

	rec := do(s, http.MethodGet, "/api/v1/analytics/montecarlo?account_id="+acc+"&paths=300&seed=42", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var res struct {
		InsufficientData bool   `json:"insufficient_data"`
		Trades           int    `json:"trades"`
		Paths            int    `json:"paths"`
		Horizon          int    `json:"horizon"`
		Seed             uint64 `json:"seed"`
		Steps            []struct {
			N   int     `json:"n"`
			P50 float64 `json:"p50"`
		} `json:"steps"`
		Terminal struct {
			P50          float64 `json:"p50"`
			ProbNegative float64 `json:"prob_negative"`
		} `json:"terminal"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.False(t, res.InsufficientData)
	require.Equal(t, 12, res.Trades)
	require.Equal(t, 300, res.Paths)
	require.Equal(t, 12, res.Horizon)
	require.Equal(t, uint64(42), res.Seed)
	require.NotEmpty(t, res.Steps)
	// Every trade nets +2: all paths are the same deterministic staircase.
	require.Equal(t, 24.0, res.Terminal.P50)
	require.Zero(t, res.Terminal.ProbNegative)

	// Same seed reproduces the identical body.
	again := do(s, http.MethodGet, "/api/v1/analytics/montecarlo?account_id="+acc+"&paths=300&seed=42", "", tok)
	require.Equal(t, rec.Body.String(), again.Body.String())
}

func TestMonteCarloEndpointInsufficientData(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "montecarlo-few@x.com")
	acc := accountID(t, s, tok)
	seedRoundTrips(t, s, tok, acc, 2)

	rec := do(s, http.MethodGet, "/api/v1/analytics/montecarlo?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var res struct {
		InsufficientData bool `json:"insufficient_data"`
		Trades           int  `json:"trades"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	require.True(t, res.InsufficientData)
	require.Equal(t, 2, res.Trades)
}

func TestMonteCarloEndpointRejectsBadParams(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "montecarlo-bad@x.com")
	for _, q := range []string{"seed=abc", "paths=-1", "horizon=x", "ruin_threshold=-5"} {
		rec := do(s, http.MethodGet, "/api/v1/analytics/montecarlo?"+q, "", tok)
		require.Equal(t, http.StatusBadRequest, rec.Code, q)
	}
}

func TestMonteCarloEndpointRequiresAuth(t *testing.T) {
	s := testServer(t)
	rec := do(s, http.MethodGet, "/api/v1/analytics/montecarlo", "", "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
