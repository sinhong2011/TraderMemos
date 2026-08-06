package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// enrolTotp walks the two-call setup and returns the confirmed secret.
func enrolTotp(t *testing.T, s *api.Server, tok string) string {
	t.Helper()

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/start", "", tok))
	require.Equal(t, http.StatusOK, rec.Code)
	var start struct {
		Secret     string `json:"secret"`
		OtpauthURL string `json:"otpauth_url"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &start))
	require.NotEmpty(t, start.Secret)
	require.Contains(t, start.OtpauthURL, "otpauth://totp/")

	code, err := totp.GenerateCode(start.Secret, time.Now())
	require.NoError(t, err)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/confirm",
		`{"secret":"`+start.Secret+`","code":"`+code+`"}`, tok))
	require.Equal(t, http.StatusNoContent, rec.Code)
	return start.Secret
}

func TestTotpConfirmRejectsWrongCode(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/start", "", tok))
	var start struct {
		Secret string `json:"secret"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &start))

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/confirm",
		`{"secret":"`+start.Secret+`","code":"000000"}`, tok))
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// Nothing was stored, so /me still reports it off.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/me", "", tok))
	var me struct {
		TotpEnabled bool `json:"totp_enabled"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &me))
	require.False(t, me.TotpEnabled)
}

func TestTotpEnrolThenLoginRequiresCode(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	secret := enrolTotp(t, s, tok)

	// /me now reports it on.
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodGet, "/api/v1/me", "", tok))
	var me struct {
		TotpEnabled bool `json:"totp_enabled"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &me))
	require.True(t, me.TotpEnabled)

	// Password alone no longer signs in — and the reason is distinguishable
	// from a bad password, or the client cannot know to ask for a code.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"`+testPassword+`"}`, ""))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Contains(t, rec.Body.String(), "totp_required")

	// A wrong code is rejected too.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"`+testPassword+`","totp_code":"000000"}`, ""))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Contains(t, rec.Body.String(), "totp_invalid")

	// Password plus a live code works.
	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"`+testPassword+`","totp_code":"`+code+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)
}

// A wrong password must not reveal whether the account has a second factor.
func TestLoginWithBadPasswordNeverLeaksTotpState(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	enrolTotp(t, s, tok)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"wrong-password"}`, ""))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.NotContains(t, rec.Body.String(), "totp")
}

func TestTotpStartRejectsWhenAlreadyEnrolled(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	enrolTotp(t, s, tok)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/start", "", tok))
	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestTotpDisableNeedsPasswordAndCode(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	secret := enrolTotp(t, s, tok)

	code, err := totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)

	// Right code, wrong password — a borrowed unlocked session must not be
	// able to strip the factor.
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/disable",
		`{"password":"wrong-password","code":"`+code+`"}`, tok))
	require.Equal(t, http.StatusForbidden, rec.Code)

	// Right password, wrong code.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/disable",
		`{"password":"`+testPassword+`","code":"000000"}`, tok))
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// Both correct.
	code, err = totp.GenerateCode(secret, time.Now())
	require.NoError(t, err)
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/me/totp/disable",
		`{"password":"`+testPassword+`","code":"`+code+`"}`, tok))
	require.Equal(t, http.StatusNoContent, rec.Code)

	// Password alone signs in again.
	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login",
		`{"email":"owner@example.com","password":"`+testPassword+`"}`, ""))
	require.Equal(t, http.StatusOK, rec.Code)
}
