package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPatchTradeWritesJournalAndDetail(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "j@x.com")
	acc := accountID(t, s, tok)
	id := closedTradeID(t, s, tok, acc) // AAPL +200 (100@10 -> 100@12)

	// a setup to attach
	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var setup map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))
	setupID := setup["id"].(string)

	body := `{"notes":"clean break","setup_id":"` + setupID + `","initial_risk":100}`
	rec = do(s, http.MethodPatch, "/api/v1/trades/"+id, body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades/"+id, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var d map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	require.Equal(t, "clean break", d["notes"])
	require.Equal(t, 2.0, d["r_multiple"]) // net 200 / risk 100
	require.NotNil(t, d["setup"])
	require.Equal(t, "ORB", d["setup"].(map[string]any)["name"])

	// fills present (2)
	fills, ok := d["fills"].([]any)
	require.True(t, ok)
	require.Len(t, fills, 2)

	// partial PATCH (notes only) keeps setup + risk
	rec = do(s, http.MethodPatch, "/api/v1/trades/"+id, `{"notes":"updated"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/trades/"+id, "", tok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	require.Equal(t, "updated", d["notes"])
	require.Equal(t, 2.0, d["r_multiple"]) // risk preserved
}

func TestCreateMistakeTag(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "m@x.com")
	rec := do(s, http.MethodPost, "/api/v1/tags", `{"name":"FOMO","kind":"mistake"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var tag map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tag))
	require.Equal(t, "mistake", tag["kind"])
}
