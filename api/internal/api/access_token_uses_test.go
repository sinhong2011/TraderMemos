package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type tokenUse struct {
	UsedAt    string `json:"used_at"`
	IP        string `json:"ip"`
	UserAgent string `json:"user_agent"`
}

// mintPAT creates a personal access token and returns its id and secret.
func mintPAT(t *testing.T, s *api.Server, tok, name string) (string, string) {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/access-tokens",
		`{"name":"`+name+`"}`, tok))
	require.Equal(t, http.StatusCreated, rec.Code)
	var out struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotEmpty(t, out.Token)
	return out.ID, out.Token
}

func listUses(t *testing.T, s *api.Server, tok, tokenID string) []tokenUse {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/access-tokens/"+tokenID+"/uses", "", tok))
	require.Equal(t, http.StatusOK, rec.Code)
	var uses []tokenUse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &uses))
	return uses
}

func TestAccessTokenUseIsRecordedWithIPAndAgent(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	id, secret := mintPAT(t, s, tok, "ci")

	require.Empty(t, listUses(t, s, tok, id), "no uses before the token is used")

	req := jsonReq(http.MethodGet, "/api/v1/accounts", "", secret)
	req.Header.Set("User-Agent", "curl/8.4.0")
	req.RemoteAddr = "203.0.113.7:54321"
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	uses := listUses(t, s, tok, id)
	require.Len(t, uses, 1)
	require.Equal(t, "curl/8.4.0", uses[0].UserAgent)
	require.Equal(t, "203.0.113.7", uses[0].IP)
}

// The throttle exists so a token driving a cron does not write a row per
// request — but a *different* client must still be caught immediately.
func TestAccessTokenUseThrottlesSameClientButNotNewOnes(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	id, secret := mintPAT(t, s, tok, "ci")

	call := func(agent, addr string) {
		req := jsonReq(http.MethodGet, "/api/v1/accounts", "", secret)
		req.Header.Set("User-Agent", agent)
		req.RemoteAddr = addr
		rec := httptest.NewRecorder()
		s.Echo.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)
	}

	call("curl/8.4.0", "203.0.113.7:1")
	call("curl/8.4.0", "203.0.113.7:2")
	call("curl/8.4.0", "203.0.113.7:3")
	require.Len(t, listUses(t, s, tok, id), 1, "same client inside the window collapses")

	call("python-requests/2.32", "203.0.113.7:4")
	require.Len(t, listUses(t, s, tok, id), 2, "a new user-agent is recorded at once")

	call("curl/8.4.0", "198.51.100.9:5")
	require.Len(t, listUses(t, s, tok, id), 3, "a new IP is recorded at once")
}

// One user must not be able to read another's token history by guessing an id.
func TestAccessTokenUsesAreScopedToTheOwner(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	id, secret := mintPAT(t, s, owner, "ci")

	req := jsonReq(http.MethodGet, "/api/v1/accounts", "", secret)
	req.Header.Set("User-Agent", "curl/8.4.0")
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Len(t, listUses(t, s, owner, id), 1)

	other := registerAndLogin(t, s, "other@example.com")
	require.Empty(t, listUses(t, s, other, id), "another user sees nothing")
}
