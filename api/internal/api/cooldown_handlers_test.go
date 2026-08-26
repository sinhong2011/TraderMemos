package api_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type cooldownResp struct {
	ID            string  `json:"id"`
	DurationSec   int64   `json:"duration_sec"`
	Trigger       string  `json:"trigger"`
	Impulse       string  `json:"impulse"`
	Phase         string  `json:"phase"`
	ReleasedAt    *string `json:"released_at"`
	ReleasedEarly bool    `json:"released_early"`
	SetupID       *string `json:"setup_id"`
	ReturnRule    string  `json:"return_rule"`
	Reflection    string  `json:"reflection"`
}

func activeCooldown(t *testing.T, s *api.Server, tok string) *cooldownResp {
	t.Helper()
	rec := do(s, http.MethodGet, "/api/v1/cooldowns/active", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out struct {
		Session *cooldownResp `json:"session"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out.Session
}

func TestCooldownLifecycle(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "cool@example.com")

	require.Nil(t, activeCooldown(t, s, tok), "nothing active on a fresh user")

	// Bad durations are rejected.
	rec := do(s, http.MethodPost, "/api/v1/cooldowns", `{"duration_sec":10}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	rec = do(s, http.MethodPost, "/api/v1/cooldowns", `{"duration_sec":300,"impulse":"greed"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())

	rec = do(s, http.MethodPost, "/api/v1/cooldowns", `{"duration_sec":300,"impulse":"revenge"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var started cooldownResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &started))
	require.Equal(t, "counting", started.Phase)
	require.Equal(t, "manual", started.Trigger)
	require.Equal(t, "revenge", started.Impulse)
	require.EqualValues(t, 300, started.DurationSec)

	active := activeCooldown(t, s, tok)
	require.NotNil(t, active)
	require.Equal(t, started.ID, active.ID)

	// A second start while one runs conflicts and hands back the running one.
	rec = do(s, http.MethodPost, "/api/v1/cooldowns", `{"duration_sec":120}`, tok)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), started.ID)

	// Extending adds to the clock.
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/extend", `{"duration_sec":300}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var extended cooldownResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &extended))
	require.EqualValues(t, 600, extended.DurationSec)

	// Early release needs a reflection.
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/release",
		`{"impulse":"fomo","return_rule":"one_trade","reflection":"nah"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	require.NotNil(t, activeCooldown(t, s, tok), "a rejected release keeps the lock")

	// Unknown setup is rejected.
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/release",
		`{"impulse":"fomo","return_rule":"one_trade","setup_id":"nope","reflection":"`+strings.Repeat("x", 50)+`"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())

	rec = do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var setup struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))

	reflection := "I want to make the loss back right now and that is exactly the trade I regret."
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/release",
		`{"impulse":"fomo","return_rule":"one_trade","setup_id":"`+setup.ID+`","reflection":"`+reflection+`"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var released cooldownResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &released))
	require.Equal(t, "released", released.Phase)
	require.True(t, released.ReleasedEarly)
	require.NotNil(t, released.ReleasedAt)
	require.Equal(t, "fomo", released.Impulse)
	require.Equal(t, "one_trade", released.ReturnRule)
	require.NotNil(t, released.SetupID)
	require.Equal(t, setup.ID, *released.SetupID)
	require.Equal(t, reflection, released.Reflection)

	require.Nil(t, activeCooldown(t, s, tok), "released session no longer locks")

	// Releasing or extending a closed session conflicts.
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/release", `{"return_rule":"none"}`, tok)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/extend", `{"duration_sec":60}`, tok)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())

	// History lists it; another user sees nothing.
	rec = do(s, http.MethodGet, "/api/v1/cooldowns", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var list []cooldownResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)

	other := registerAndLogin(t, s, "other@example.com")
	rec = do(s, http.MethodPost, "/api/v1/cooldowns/"+started.ID+"/extend", `{"duration_sec":60}`, other)
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())

	// Stats endpoint reads the released session.
	rec = do(s, http.MethodGet, "/api/v1/analytics/cooldowns", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var stats struct {
		Sessions      int            `json:"sessions"`
		Released      int            `json:"released"`
		EarlyReleases int            `json:"early_releases"`
		ByImpulse     map[string]int `json:"by_impulse"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &stats))
	require.Equal(t, 1, stats.Sessions)
	require.Equal(t, 1, stats.Released)
	require.Equal(t, 1, stats.EarlyReleases)
	require.Equal(t, 1, stats.ByImpulse["fomo"])

	// Compliance now scores the one_trade commitment (no trades after it → no breach).
	rec = do(s, http.MethodGet, "/api/v1/analytics/compliance", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), `"return_rule_breaches":0`)
}

func TestRiskRulesCooldownMinutes(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "rules@example.com")

	rec := do(s, http.MethodPut, "/api/v1/settings/risk-rules", `{"cooldown_minutes":15,"max_consecutive_losses":3}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), `"cooldown_minutes":15`)

	rec = do(s, http.MethodGet, "/api/v1/settings/risk-rules", "", tok)
	require.Contains(t, rec.Body.String(), `"cooldown_minutes":15`)

	rec = do(s, http.MethodPut, "/api/v1/settings/risk-rules", `{"cooldown_minutes":9999}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
}
