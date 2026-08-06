package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/auth"
)

func TestMeReturnsSignedInUser(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/me", "", tok))
	require.Equal(t, http.StatusOK, rec.Code)

	var out struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		IsAdmin     bool   `json:"is_admin"`
		TotpEnabled bool   `json:"totp_enabled"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "owner@example.com", out.Email)
	require.NotEmpty(t, out.ID)
	// The first user goes through /setup, which makes them the owner.
	require.True(t, out.IsAdmin)
	require.False(t, out.TotpEnabled)
}

func TestMeRequiresAuth(t *testing.T) {
	s := testServer(t)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/me", "", ""))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestChangePasswordRejectsWrongCurrent(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPut, "/api/v1/me/password",
		`{"current_password":"not-the-password","new_password":"replacement1"}`, tok))
	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestChangePasswordRejectsShortNew(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPut, "/api/v1/me/password",
		`{"current_password":"`+testPassword+`","new_password":"short"}`, tok))
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

// The point of the whole design: after a password change, a refresh token
// minted against the old password must stop working, while the caller who
// changed it keeps a usable pair.
func TestChangePasswordInvalidatesOtherRefreshTokens(t *testing.T) {
	s := testServer(t)
	registerAndLogin(t, s, "owner@example.com")

	// A second device: log in separately and keep its refresh token.
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"`+testPassword+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)
	var other struct {
		Access  string `json:"access_token"`
		Refresh string `json:"refresh_token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &other))

	// That token refreshes fine before the change.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/refresh",
		`{"refresh_token":"`+other.Refresh+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)

	// Change the password from the first device.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPut, "/api/v1/me/password",
		`{"current_password":"`+testPassword+`","new_password":"replacement1"}`, other.Access))
	require.Equal(t, http.StatusOK, rec.Code)
	var fresh struct {
		Access  string `json:"access_token"`
		Refresh string `json:"refresh_token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &fresh))
	require.NotEmpty(t, fresh.Refresh)

	// The old refresh token is now dead...
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/refresh",
		`{"refresh_token":"`+other.Refresh+`"}`, ""))
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	// ...and the pair handed back by the change still works.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/refresh",
		`{"refresh_token":"`+fresh.Refresh+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)

	// The new password is the one that logs in now.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"replacement1"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)
}

// Tokens minted before the `pv` claim existed carry an empty one; deploying
// this must not sign everyone out.
func TestRefreshGrandfathersTokensWithoutVersionClaim(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/me", "", tok))
	var me struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &me))

	// Same secret testServer uses; empty `pv` is what pre-upgrade tokens carry.
	legacy, err := auth.NewJWT("test").Mint(me.ID, 24*time.Hour, auth.TokenRefresh, "")
	require.NoError(t, err)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/refresh",
		`{"refresh_token":"`+legacy+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)
}
