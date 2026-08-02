package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFlexSyncSettingsCRUD(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "flex@x.com")
	acc := accountID(t, s, tok)

	// Unconfigured by default.
	rec := do(s, http.MethodGet, "/api/v1/accounts/"+acc+"/flex-sync", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, false, got["configured"])

	// First save requires a token.
	rec = do(s, http.MethodPut, "/api/v1/accounts/"+acc+"/flex-sync",
		`{"query_id":"q42","enabled":true}`, tok)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	rec = do(s, http.MethodPut, "/api/v1/accounts/"+acc+"/flex-sync",
		`{"query_id":"q42","enabled":true,"token":"secret-token-1234"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["configured"])
	require.Equal(t, true, got["token_set"])
	require.Equal(t, "…1234", got["token_hint"])
	require.Nil(t, got["token"], "raw token must never be returned")

	// Update without a token keeps the stored one.
	rec = do(s, http.MethodPut, "/api/v1/accounts/"+acc+"/flex-sync",
		`{"query_id":"q43","enabled":false}`, tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "q43", got["query_id"])
	require.Equal(t, false, got["enabled"])
	require.Equal(t, "…1234", got["token_hint"])

	// Manual run without a client is unavailable rather than a crash.
	rec = do(s, http.MethodPost, "/api/v1/accounts/"+acc+"/flex-sync/run", "", tok)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)

	rec = do(s, http.MethodDelete, "/api/v1/accounts/"+acc+"/flex-sync", "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/accounts/"+acc+"/flex-sync", "", tok)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, false, got["configured"])
}

func TestFlexSyncIsolatedPerUser(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "flexa@x.com")
	accA := accountID(t, s, tokA)
	rec := do(s, http.MethodPut, "/api/v1/accounts/"+accA+"/flex-sync",
		`{"query_id":"q1","enabled":true,"token":"tok-aaaa"}`, tokA)
	require.Equal(t, http.StatusOK, rec.Code)

	tokB := registerAndLogin(t, s, "flexb@x.com")
	rec = do(s, http.MethodGet, "/api/v1/accounts/"+accA+"/flex-sync", "", tokB)
	require.Equal(t, http.StatusNotFound, rec.Code)
	rec = do(s, http.MethodPut, "/api/v1/accounts/"+accA+"/flex-sync",
		`{"query_id":"q9","enabled":true,"token":"tok-bbbb"}`, tokB)
	require.Equal(t, http.StatusNotFound, rec.Code)
}
