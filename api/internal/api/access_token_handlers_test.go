package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccessTokenCRUDAndAuth(t *testing.T) {
	s := testServer(t)
	jwtTok := registerAndLogin(t, s, "pat@example.com")

	// Create
	rec := do(s, http.MethodPost, "/api/v1/access-tokens", `{"name":"MCP bot","expires_in_days":30}`, jwtTok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		TokenPrefix string  `json:"token_prefix"`
		Token       string  `json:"token"`
		ExpiresAt   *string `json:"expires_at"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.Equal(t, "MCP bot", created.Name)
	require.NotEmpty(t, created.Token)
	require.True(t, len(created.TokenPrefix) > 0)
	require.NotNil(t, created.ExpiresAt)

	// List (no secret)
	rec = do(s, http.MethodGet, "/api/v1/access-tokens", "", jwtTok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var listed []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &listed))
	require.Len(t, listed, 1)
	_, hasToken := listed[0]["token"]
	require.False(t, hasToken)

	// Use PAT against a protected route
	rec = do(s, http.MethodGet, "/api/v1/access-tokens", "", created.Token)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	// Revoke
	rec = do(s, http.MethodDelete, "/api/v1/access-tokens/"+created.ID, "", jwtTok)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	// Revoked PAT rejected
	rec = do(s, http.MethodGet, "/api/v1/access-tokens", "", created.Token)
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	// List empty after revoke
	rec = do(s, http.MethodGet, "/api/v1/access-tokens", "", jwtTok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &listed))
	require.Len(t, listed, 0)
}

func TestAccessTokenCreateNeverExpires(t *testing.T) {
	s := testServer(t)
	jwtTok := registerAndLogin(t, s, "pat-never@example.com")
	rec := do(s, http.MethodPost, "/api/v1/access-tokens", `{"name":"forever"}`, jwtTok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created struct {
		Token     string  `json:"token"`
		ExpiresAt *string `json:"expires_at"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.NotEmpty(t, created.Token)
	require.Nil(t, created.ExpiresAt)
}

func TestAccessTokenCreateRejectsBadExpiry(t *testing.T) {
	s := testServer(t)
	jwtTok := registerAndLogin(t, s, "pat-bad@example.com")
	rec := do(s, http.MethodPost, "/api/v1/access-tokens", `{"name":"x","expires_in_days":7}`, jwtTok)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
