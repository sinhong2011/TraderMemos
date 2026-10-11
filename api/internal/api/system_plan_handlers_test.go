package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type planResp struct {
	ID           string  `json:"id"`
	VersionLabel string  `json:"version_label"`
	Symbol       string  `json:"symbol"`
	Status       string  `json:"status"`
	TradeID      *string `json:"trade_id"`
	Trade        *struct {
		ID string `json:"id"`
	} `json:"trade"`
	Latest *struct {
		Seq        int64  `json:"seq"`
		Stage      string `json:"stage"`
		Thesis     string `json:"thesis"`
		Conditions map[string]struct {
			Answer string `json:"answer"`
			Note   string `json:"note"`
		} `json:"conditions"`
	} `json:"latest"`
	Revisions []struct {
		Seq    int64  `json:"seq"`
		Stage  string `json:"stage"`
		Thesis string `json:"thesis"`
	} `json:"revisions"`
	Events []struct {
		Kind       string `json:"kind"`
		FromStatus string `json:"from_status"`
		ToStatus   string `json:"to_status"`
		TradeID    string `json:"trade_id"`
		Reason     string `json:"reason"`
	} `json:"events"`
}

func decodePlan(t *testing.T, rec *httptest.ResponseRecorder) planResp {
	t.Helper()
	var p planResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &p), rec.Body.String())
	return p
}

func activateBareSystem(t *testing.T, s *api.Server, tok string) {
	t.Helper()
	rec := do(s, http.MethodPost, "/api/v1/system/versions", "", tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var draft struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &draft))
	rec = do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate", `{"changes":[]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
}

func TestSystemPlanLifecycle(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "plans@example.com")
	acc := accountID(t, s, tok)

	body := `{"symbol":" nvda ","direction":"long","revision":{"thesis":"Base breakout","entry_price":120,"stop_price":114,
		"conditions":{"market":{"answer":"yes","note":"above 50dma"},"setup":{"answer":""}}}}`
	rec := do(s, http.MethodPost, "/api/v1/system/plans", body, tok)
	require.Equal(t, http.StatusConflict, rec.Code, "planning needs an active version")

	activateBareSystem(t, s, tok)

	rec = do(s, http.MethodPost, "/api/v1/system/plans", `{"symbol":"NVDA","direction":"sideways"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/system/plans",
		`{"symbol":"NVDA","direction":"long","revision":{"conditions":{"bogus":{"answer":"yes"}}}}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/system/plans", `{"symbol":"NVDA","direction":"long","source":"retrospective"}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, "retrospective plans need occurred_at")

	rec = do(s, http.MethodPost, "/api/v1/system/plans", body, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	plan := decodePlan(t, rec)
	require.Equal(t, "NVDA", plan.Symbol)
	require.Equal(t, "planned", plan.Status)
	require.Equal(t, "v1.0", plan.VersionLabel)
	require.Equal(t, int64(1), plan.Latest.Seq)
	require.Equal(t, "before_fill", plan.Latest.Stage)
	require.Equal(t, "yes", plan.Latest.Conditions["market"].Answer)
	require.NotContains(t, plan.Latest.Conditions, "setup", "empty answers are not stored")
	base := "/api/v1/system/plans/" + plan.ID

	// Other users cannot see or touch it.
	other := registerAndLogin(t, s, "plans-other@example.com")
	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, base, "", other).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodPost, base+"/status", `{"status":"waiting"}`, other).Code)

	// Revisions append; the first stays readable.
	rec = do(s, http.MethodPost, base+"/revisions", `{"thesis":"Base breakout, tighter stop","stop_price":116}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	plan = decodePlan(t, rec)
	require.Len(t, plan.Revisions, 2)
	require.Equal(t, "Base breakout", plan.Revisions[0].Thesis)
	require.Equal(t, int64(2), plan.Latest.Seq)

	// Transitions.
	require.Equal(t, http.StatusConflict, do(s, http.MethodPost, base+"/status", `{"status":"taken"}`, tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, base+"/status", `{"status":"waiting"}`, tok).Code)
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base+"/status", `{"status":"skipped"}`, tok).Code, "skip needs a reason")
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, base+"/status", `{"status":"skipped","reason":"gapped above entry"}`, tok).Code)
	require.Equal(t, http.StatusConflict, do(s, http.MethodPost, base+"/revisions", `{"thesis":"x"}`, tok).Code, "closed plans are read-only")
	require.Equal(t, http.StatusConflict, do(s, http.MethodPost, base+"/status", `{"status":"waiting"}`, tok).Code)
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base+"/status", `{"status":"planned"}`, tok).Code, "reopen needs a reason")
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, base+"/status", `{"status":"planned","reason":"pulled back in"}`, tok).Code)

	// Link a trade.
	postExec := func(sym, side string, px float64, when string) {
		rec := do(s, http.MethodPost, "/api/v1/executions", `{"account_id":"`+acc+`","symbol":"`+sym+`","side":"`+side+`",
			"quantity":10,"price":`+jsonFloat(px)+`,"executed_at":"`+when+`"}`, tok)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	}
	postExec("NVDA", "buy", 120, "2026-09-01T14:00:00Z")
	postExec("NVDA", "sell", 130, "2026-09-01T15:00:00Z")
	postExec("AMD", "buy", 100, "2026-09-02T14:00:00Z")

	rec = do(s, http.MethodGet, base+"/trades", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var cands []struct {
		ID           string  `json:"id"`
		Symbol       string  `json:"symbol"`
		LinkedPlanID *string `json:"linked_plan_id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cands))
	require.Len(t, cands, 1, "only same-symbol trades are candidates")
	require.Nil(t, cands[0].LinkedPlanID)
	tradeID := cands[0].ID

	require.Equal(t, http.StatusNotFound, do(s, http.MethodPost, base+"/link", `{"trade_id":"nope"}`, tok).Code)
	rec = do(s, http.MethodPost, base+"/link", `{"trade_id":"`+tradeID+`"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	plan = decodePlan(t, rec)
	require.Equal(t, "taken", plan.Status)
	require.NotNil(t, plan.Trade)
	require.Equal(t, tradeID, plan.Trade.ID)

	// After the fill, revisions are stamped after_fill.
	rec = do(s, http.MethodPost, base+"/revisions", `{"thesis":"Exited into strength"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	plan = decodePlan(t, rec)
	require.Equal(t, "after_fill", plan.Latest.Stage)
	require.Equal(t, "before_fill", plan.Revisions[1].Stage)

	// A second plan cannot claim the same trade.
	rec = do(s, http.MethodPost, "/api/v1/system/plans", `{"symbol":"NVDA","direction":"long"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)
	second := decodePlan(t, rec)
	rec = do(s, http.MethodPost, "/api/v1/system/plans/"+second.ID+"/link", `{"trade_id":"`+tradeID+`"}`, tok)
	require.Equal(t, http.StatusConflict, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/system/plans/"+second.ID+"/trades", "", tok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cands))
	require.NotNil(t, cands[0].LinkedPlanID)
	require.Equal(t, plan.ID, *cands[0].LinkedPlanID)

	// Unlink needs a reason, returns to waiting, and frees the trade.
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base+"/unlink", `{}`, tok).Code)
	rec = do(s, http.MethodPost, base+"/unlink", `{"reason":"wrong fill"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	plan = decodePlan(t, rec)
	require.Equal(t, "waiting", plan.Status)
	require.Nil(t, plan.TradeID)
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, "/api/v1/system/plans/"+second.ID+"/link", `{"trade_id":"`+tradeID+`"}`, tok).Code)

	kinds := []string{}
	for _, e := range plan.Events {
		kinds = append(kinds, e.Kind+":"+e.ToStatus)
	}
	require.Equal(t, []string{
		"status:planned", "status:waiting", "status:skipped", "status:planned", "link:taken", "unlink:waiting",
	}, kinds)
	require.Equal(t, "gapped above entry", plan.Events[2].Reason)
	require.Equal(t, tradeID, plan.Events[5].TradeID)

	rec = do(s, http.MethodGet, "/api/v1/system/plans", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var list []planResp
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 2)
	require.Equal(t, second.ID, list[0].ID, "newest first")
	require.Equal(t, int64(3), list[1].Latest.Seq)
}
