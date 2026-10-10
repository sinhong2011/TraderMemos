package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type evidenceRev struct {
	Seq    int64  `json:"seq"`
	Body   string `json:"body"`
	Action string `json:"action"`
}

type evidenceList struct {
	Entries []struct {
		ID             string        `json:"id"`
		WithdrawnAt    *string       `json:"withdrawn_at"`
		WithdrawReason string        `json:"withdraw_reason"`
		Latest         *evidenceRev  `json:"latest"`
		Revisions      []evidenceRev `json:"revisions"`
	} `json:"entries"`
	ScalingRule string `json:"scaling_rule"`
	Prompt      *struct {
		Kind string `json:"kind"`
	} `json:"prompt"`
}

func TestSystemPlanEvidence(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "evidence@example.com")
	acc := accountID(t, s, tok)

	rec := do(s, http.MethodPost, "/api/v1/system/versions", "", tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var draft struct {
		ID    string         `json:"id"`
		Rules map[string]any `json:"rules"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &draft))
	rules := map[string]any{}
	for k := range draft.Rules {
		text := "Rule for " + k
		if k == "scaling" {
			text = "Add only on a new high with volume. Trim into a failed break."
		}
		rules[k] = map[string]any{"text": text, "executable": k == "scaling"}
	}
	body, err := json.Marshal(map[string]any{
		"label": "v1.0", "rules": rules,
		"regimes":        map[string]string{"normal": "Normal", "defensive": "Defensive", "paused": "Paused"},
		"trade_types":    map[string]string{"momentum": "Momentum", "position": "Position"},
		"open_questions": map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, do(s, http.MethodPut, "/api/v1/system/versions/"+draft.ID, string(body), tok).Code)
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, "/api/v1/system/versions/"+draft.ID+"/activate", `{"changes":[]}`, tok).Code)

	rec = do(s, http.MethodPost, "/api/v1/system/plans", `{"symbol":"NVDA","direction":"long","revision":{"thesis":"breakout"}}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	plan := decodePlan(t, rec)
	base := "/api/v1/system/plans/" + plan.ID + "/evidence"

	note := `{"decision_id":"scaling","stance":"support","body":"Volume held on the add","state":"still_working","action":"add"}`
	rec = do(s, http.MethodPost, base, note, tok)
	require.Equal(t, http.StatusConflict, rec.Code, "evidence needs a linked trade")

	postExec := func(side string, px float64, when string) {
		rec := do(s, http.MethodPost, "/api/v1/executions", `{"account_id":"`+acc+`","symbol":"NVDA","side":"`+side+`",
			"quantity":10,"price":`+jsonFloat(px)+`,"executed_at":"`+when+`"}`, tok)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	}
	postExec("buy", 100, "2026-09-01T14:00:00Z")
	postExec("sell", 110, "2026-09-01T16:00:00Z")
	rec = do(s, http.MethodGet, "/api/v1/system/plans/"+plan.ID+"/trades", "", tok)
	var cands []struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cands))
	require.NotEmpty(t, cands)
	tradeID := cands[0].ID
	require.Equal(t, http.StatusOK, do(s, http.MethodPost, "/api/v1/system/plans/"+plan.ID+"/link", `{"trade_id":"`+tradeID+`"}`, tok).Code)

	rec = do(s, http.MethodPut, "/api/v1/trades/"+tradeID+"/system-card", `{"time_stop_days":1,"thesis":"planned"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	other := registerAndLogin(t, s, "evidence-other@example.com")
	require.Equal(t, http.StatusNotFound, do(s, http.MethodGet, base, "", other).Code)

	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base, `{"decision_id":"nope","stance":"support","body":"x","state":"still_working","action":"hold"}`, tok).Code)
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base, `{"decision_id":"scaling","stance":"support","body":"  ","state":"still_working","action":"hold"}`, tok).Code)
	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base, `{"decision_id":"scaling","stance":"support","body":"added late","state":"still_working","action":"add","source":"retrospective"}`, tok).Code)

	rec = do(s, http.MethodGet, base, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var list evidenceList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Empty(t, list.Entries)
	require.Contains(t, list.ScalingRule, "Add only on a new high")
	require.NotNil(t, list.Prompt)
	require.Equal(t, "time_stop", list.Prompt.Kind, "a due time stop asks; it does not write a record")

	rec = do(s, http.MethodPost, base, note, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list.Entries, 1)
	entry := list.Entries[0]
	require.Equal(t, int64(1), entry.Latest.Seq)
	require.Equal(t, "Volume held on the add", entry.Latest.Body)
	require.Equal(t, "add", entry.Latest.Action)
	require.Nil(t, entry.WithdrawnAt)
	eid := entry.ID

	rec = do(s, http.MethodPost, base+"/"+eid+"/revisions",
		`{"decision_id":"scaling","stance":"uncertain","body":"Volume faded after the add","state":"not_working","action":"trim","occurred_at":"2026-09-01T15:30:00Z"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list.Entries[0].Revisions, 2)
	require.Equal(t, "Volume held on the add", list.Entries[0].Revisions[0].Body)
	require.Equal(t, int64(2), list.Entries[0].Latest.Seq)
	require.Equal(t, "trim", list.Entries[0].Latest.Action)

	require.Equal(t, http.StatusBadRequest, do(s, http.MethodPost, base+"/"+eid+"/withdraw", `{}`, tok).Code)
	rec = do(s, http.MethodPost, base+"/"+eid+"/withdraw", `{"reason":"wrote the wrong trade"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.NotNil(t, list.Entries[0].WithdrawnAt)
	require.Equal(t, "wrote the wrong trade", list.Entries[0].WithdrawReason)
	require.Equal(t, "Volume held on the add", list.Entries[0].Revisions[0].Body, "withdrawing keeps the original")
	require.Equal(t, http.StatusConflict, do(s, http.MethodPost, base+"/"+eid+"/revisions", note, tok).Code)
	require.Equal(t, http.StatusConflict, do(s, http.MethodPost, base+"/"+eid+"/withdraw", `{"reason":"again"}`, tok).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodPost, base+"/missing/withdraw", `{"reason":"x"}`, tok).Code)
}
