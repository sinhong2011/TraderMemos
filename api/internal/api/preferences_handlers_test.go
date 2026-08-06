package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type prefsResponse struct {
	Prefs     map[string]any `json:"prefs"`
	UpdatedAt *string        `json:"updated_at"`
}

func prefsCall(t *testing.T, s *api.Server, method, body, tok string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(method, "/api/v1/me/preferences", body, tok))
	return rec
}

func readPrefs(t *testing.T, rec *httptest.ResponseRecorder) prefsResponse {
	t.Helper()
	var out prefsResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// A fresh account has never synced anything. That has to be an empty object,
// not a 404 the clients each have to special-case.
func TestPreferencesStartEmpty(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := prefsCall(t, s, http.MethodGet, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	got := readPrefs(t, rec)
	require.Empty(t, got.Prefs)
	require.Nil(t, got.UpdatedAt)
}

func TestPreferencesRoundTrip(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	rec := prefsCall(t, s, http.MethodPatch, `{"marketTimezone":"Asia/Hong_Kong","timeFormat":"h23"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NotNil(t, readPrefs(t, rec).UpdatedAt)

	got := readPrefs(t, prefsCall(t, s, http.MethodGet, "", tok))
	require.Equal(t, "Asia/Hong_Kong", got.Prefs["marketTimezone"])
	require.Equal(t, "h23", got.Prefs["timeFormat"])
}

// The reason PATCH merges rather than replaces: two devices editing different
// preferences must not undo each other, and neither has to send a full
// snapshot built from whatever it last saw.
func TestPreferencesPatchMergesPerKey(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	require.Equal(t, http.StatusOK,
		prefsCall(t, s, http.MethodPatch, `{"timeFormat":"h23","tradeDateBasis":"open"}`, tok).Code)
	// A second device, which never saw tradeDateBasis change.
	require.Equal(t, http.StatusOK,
		prefsCall(t, s, http.MethodPatch, `{"displayCurrency":"HKD"}`, tok).Code)

	got := readPrefs(t, prefsCall(t, s, http.MethodGet, "", tok))
	require.Equal(t, "h23", got.Prefs["timeFormat"])
	require.Equal(t, "open", got.Prefs["tradeDateBasis"], "an untouched key survives another device's write")
	require.Equal(t, "HKD", got.Prefs["displayCurrency"])
}

// `displayCurrency: null` means "follow the account's base currency" — a real
// value, so it has to survive the round trip rather than delete the key.
func TestPreferencesKeepExplicitNull(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	require.Equal(t, http.StatusOK, prefsCall(t, s, http.MethodPatch, `{"displayCurrency":"HKD"}`, tok).Code)
	require.Equal(t, http.StatusOK, prefsCall(t, s, http.MethodPatch, `{"displayCurrency":null}`, tok).Code)

	got := readPrefs(t, prefsCall(t, s, http.MethodGet, "", tok))
	require.Contains(t, got.Prefs, "displayCurrency")
	require.Nil(t, got.Prefs["displayCurrency"])
}

func TestPreferencesAreScopedToTheUser(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	other := registerAndLogin(t, s, "other@example.com")

	require.Equal(t, http.StatusOK,
		prefsCall(t, s, http.MethodPatch, `{"timeFormat":"h23"}`, owner).Code)

	require.Empty(t, readPrefs(t, prefsCall(t, s, http.MethodGet, "", other)).Prefs)
}

func TestPreferencesRejectNonObjectBody(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")
	for _, body := range []string{`[1,2,3]`, `"nope"`, `null`} {
		require.Equal(t, http.StatusBadRequest, prefsCall(t, s, http.MethodPatch, body, tok).Code, body)
	}
}

// The blob is opaque, so the only thing standing between it and a free
// key-value store is a size cap.
func TestPreferencesRejectOversizedBlob(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "owner@example.com")

	huge := `{"note":"` + strings.Repeat("x", 32<<10) + `"}`
	require.Equal(t, http.StatusRequestEntityTooLarge, prefsCall(t, s, http.MethodPatch, huge, tok).Code)

	require.Empty(t, readPrefs(t, prefsCall(t, s, http.MethodGet, "", tok)).Prefs,
		"a rejected write stores nothing")
}

// Preferences hang off the user row; deleting the account must take them.
func TestPreferencesGoWithTheDeletedUser(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	member := registerAndLogin(t, s, "member@example.com")
	require.Equal(t, http.StatusOK, prefsCall(t, s, http.MethodPatch, `{"timeFormat":"h23"}`, member).Code)

	target, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")
	require.Equal(t, http.StatusNoContent,
		adminCall(t, s, http.MethodDelete, "/admin/users/"+target.ID, "", owner).Code)
}
