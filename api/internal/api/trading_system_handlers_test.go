package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTradingSystemVersionLifecycle(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "system@example.com")

	rec := do(s, http.MethodGet, "/api/v1/system", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var overview struct {
		ID     string `json:"id"`
		Active any    `json:"active"`
		Draft  any    `json:"draft"`
		Plan   []struct {
			Key  string `json:"key"`
			Done bool   `json:"done"`
		} `json:"plan"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &overview))
	require.NotEmpty(t, overview.ID)
	require.Nil(t, overview.Active)
	require.Nil(t, overview.Draft)
	require.Equal(t, "revise", overview.Plan[3].Key)

	rec = do(s, http.MethodPost, "/api/v1/system/versions", "", tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var draft struct {
		ID     string `json:"id"`
		Label  string `json:"label"`
		Status string `json:"status"`
		Rules  map[string]struct {
			Text       string `json:"text"`
			Executable bool   `json:"executable"`
		} `json:"rules"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &draft))
	require.Equal(t, "draft", draft.Status)
	require.Equal(t, "v1.0", draft.Label)

	rules := map[string]any{}
	for k := range draft.Rules {
		rules[k] = map[string]any{"text": "Rule for " + k + ": close above the 20-day high.", "executable": true}
	}
	body, _ := json.Marshal(map[string]any{
		"label": "v1.0", "rules": rules,
		"regimes": map[string]string{"normal": "Normal", "defensive": "Defensive", "paused": "Paused"},
		"trade_types": map[string]string{"momentum": "Momentum", "position": "Position"},
		"open_questions": map[string]string{},
	})
	rec = do(s, http.MethodPut, "/api/v1/system/versions/"+draft.ID, string(body), tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate", `{"changes":[]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/system", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &overview))
	require.NotNil(t, overview.Active)
	require.Nil(t, overview.Draft)

	// Second draft + activate requires change reasons.
	rec = do(s, http.MethodPost, "/api/v1/system/versions", "", tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &draft))
	require.Equal(t, "v1.1", draft.Label)

	rules["market"] = map[string]any{"text": "Updated market rule with a clear MA gate.", "executable": true}
	body, _ = json.Marshal(map[string]any{
		"label": "v1.1", "rules": rules,
		"regimes": map[string]string{"normal": "Normal", "defensive": "Defensive", "paused": "Paused"},
		"trade_types": map[string]string{"momentum": "Momentum", "position": "Position"},
		"open_questions": map[string]string{},
	})
	rec = do(s, http.MethodPut, "/api/v1/system/versions/"+draft.ID, string(body), tok)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate", `{"changes":[]}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, "reasons required when decisions change")

	rec = do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate",
		`{"changes":[{"decision":"market","reason":"regime","note":"tighten paused gate"}]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func TestSystemReviewAdherenceExcludesHesitated(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "sysreview@example.com")
	acc := accountID(t, s, tok)

	// Activate a bare system so cards can stamp a version.
	rec := do(s, http.MethodPost, "/api/v1/system/versions", "", tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	var draft struct {
		ID    string `json:"id"`
		Rules map[string]struct {
			Text       string `json:"text"`
			Executable bool   `json:"executable"`
		} `json:"rules"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &draft))
	rules := map[string]any{}
	for k := range draft.Rules {
		rules[k] = map[string]any{"text": "Clear rule " + k, "executable": true}
	}
	body, _ := json.Marshal(map[string]any{"label": "v1.0", "rules": rules,
		"regimes": map[string]string{"normal": "N", "defensive": "D", "paused": "P"},
		"trade_types": map[string]string{"momentum": "M"}, "open_questions": map[string]string{}})
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/system/versions/"+draft.ID, string(body), tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate", `{"changes":[]}`, tok).Code)

	// One full + one none adherence trade.
	postExec := func(sym string, side string, px float64, when string) {
		rec := do(s, http.MethodPost, "/api/v1/executions", `{
			"account_id":"`+acc+`","symbol":"`+sym+`","side":"`+side+`",
			"quantity":10,"price":`+jsonFloat(px)+`,"executed_at":"`+when+`"
		}`, tok)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	}
	postExec("AAA", "buy", 100, "2026-09-01T14:00:00Z")
	postExec("AAA", "sell", 110, "2026-09-01T15:00:00Z")
	postExec("BBB", "buy", 100, "2026-09-02T14:00:00Z")
	postExec("BBB", "sell", 90, "2026-09-02T15:00:00Z")

	rec = do(s, http.MethodGet, "/api/v1/trades", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []struct {
		ID     string  `json:"id"`
		Symbol string  `json:"symbol"`
		NetPnl float64 `json:"net_pnl"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 2)

	for _, tr := range trades {
		adh := "full"
		if tr.NetPnl < 0 {
			adh = "none"
		}
		rec = do(s, http.MethodPut, "/api/v1/trades/"+tr.ID+"/system-card",
			`{"adherence":"`+adh+`","regime":"normal","checklist":{}}`, tok)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	}

	// A hesitated miss in range must NOT dilute adherence_rate.
	rec = do(s, http.MethodPost, "/api/v1/missed-trades",
		`{"symbol":"CCC","direction":"long","observed_at":"2026-09-01T14:30:00Z","reason":"hesitated","account_id":"`+acc+`"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/analytics/system-review", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var review struct {
		MissedHesitated int      `json:"missed_hesitated"`
		AdherenceRate   *float64 `json:"adherence_rate"`
		Coverage        struct {
			Adherence int `json:"adherence"`
		} `json:"coverage"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &review))
	require.Equal(t, 1, review.MissedHesitated)
	require.Equal(t, 2, review.Coverage.Adherence)
	require.NotNil(t, review.AdherenceRate)
	require.InDelta(t, 0.5, *review.AdherenceRate, 1e-9, "rate is full/adherence, not diluted by misses")
}

func jsonFloat(v float64) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func TestMarketRegimeDay(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "regime@example.com")
	rec := do(s, http.MethodPut, "/api/v1/system/regimes/2026-09-10", `{"regime":"defensive","note":"below 200"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = do(s, http.MethodGet, "/api/v1/system/regimes/2026-09-10", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var day struct {
		Regime string `json:"regime"`
		Note   string `json:"note"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &day))
	require.Equal(t, "defensive", day.Regime)
}
