package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

type adminUser struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	IsAdmin     bool   `json:"is_admin"`
	TotpEnabled bool   `json:"totp_enabled"`
}

func adminCall(t *testing.T, s *api.Server, method, path, body, tok string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(method, "/api/v1"+path, body, tok))
	return rec
}

func listAdminUsers(t *testing.T, s *api.Server, tok string) []adminUser {
	t.Helper()
	rec := adminCall(t, s, http.MethodGet, "/admin/users", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []adminUser
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func findUser(users []adminUser, email string) (adminUser, bool) {
	for _, u := range users {
		if u.Email == email {
			return u, true
		}
	}
	return adminUser{}, false
}

func TestAdminListsUsers(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	registerAndLogin(t, s, "member@example.com")

	users := listAdminUsers(t, s, owner)
	require.Len(t, users, 2)

	o, ok := findUser(users, "owner@example.com")
	require.True(t, ok)
	require.True(t, o.IsAdmin, "the setup account owns the server")
	require.False(t, o.TotpEnabled)

	m, ok := findUser(users, "member@example.com")
	require.True(t, ok)
	require.False(t, m.IsAdmin)
}

// Every route under /admin is closed to a non-owner, not just the mutating ones:
// the user list itself leaks who else has an account on the box.
func TestAdminRoutesRejectNonAdmins(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	member := registerAndLogin(t, s, "member@example.com")
	target, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")

	for _, tc := range []struct{ method, path, body string }{
		{http.MethodGet, "/admin/users", ""},
		{http.MethodPost, "/admin/users", `{"email":"x@example.com","password":"correct-horse"}`},
		{http.MethodPatch, "/admin/users/" + target.ID, `{"is_admin":true}`},
		{http.MethodPost, "/admin/users/" + target.ID + "/password", `{"new_password":"correct-horse"}`},
		{http.MethodDelete, "/admin/users/" + target.ID, ""},
	} {
		rec := adminCall(t, s, tc.method, tc.path, tc.body, member)
		require.Equal(t, http.StatusForbidden, rec.Code, "%s %s", tc.method, tc.path)
	}
}

// Registration is shut by default on a self-hosted box; the owner creating an
// account has to work regardless of that setting.
func TestAdminCreatesUserWithRegistrationClosed(t *testing.T) {
	s := testServerWithRegistration(t, false)
	owner := registerAndLogin(t, s, "owner@example.com")

	closed := adminCall(t, s, http.MethodPost, "/auth/register",
		`{"email":"walkin@example.com","password":"`+testPassword+`"}`, "")
	require.NotEqual(t, http.StatusCreated, closed.Code, "sanity: sign-up is shut on this server")

	rec := adminCall(t, s, http.MethodPost, "/admin/users",
		`{"email":"invited@example.com","password":"`+testPassword+`","is_admin":true}`, owner)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var created adminUser
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))
	require.True(t, created.IsAdmin)

	login := adminCall(t, s, http.MethodPost, "/auth/login",
		`{"email":"invited@example.com","password":"`+testPassword+`"}`, "")
	require.Equal(t, http.StatusOK, login.Code, "the invited user can sign in")
}

func TestAdminRejectsShortPasswordOnCreate(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	rec := adminCall(t, s, http.MethodPost, "/admin/users",
		`{"email":"invited@example.com","password":"short"}`, owner)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAdminRejectsDuplicateEmail(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	rec := adminCall(t, s, http.MethodPost, "/admin/users",
		`{"email":"owner@example.com","password":"`+testPassword+`"}`, owner)
	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestAdminPromotesAndDemotes(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	member := registerAndLogin(t, s, "member@example.com")
	target, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")

	rec := adminCall(t, s, http.MethodPatch, "/admin/users/"+target.ID, `{"is_admin":true}`, owner)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	// The promotion has to reach a token minted before it — requireAdmin re-reads
	// the user rather than trusting a claim.
	require.Len(t, listAdminUsers(t, s, member), 2, "the promoted user can now administer")

	rec = adminCall(t, s, http.MethodPatch, "/admin/users/"+target.ID, `{"is_admin":false}`, owner)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, http.StatusForbidden,
		adminCall(t, s, http.MethodGet, "/admin/users", "", member).Code,
		"and the demotion reaches it too")
}

// Losing the last owner is unrecoverable without shell access to the box.
func TestAdminCannotRemoveTheLastOwner(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	registerAndLogin(t, s, "member@example.com")
	self, _ := findUser(listAdminUsers(t, s, owner), "owner@example.com")

	rec := adminCall(t, s, http.MethodPatch, "/admin/users/"+self.ID, `{"is_admin":false}`, owner)
	require.Equal(t, http.StatusConflict, rec.Code, "demoting the only owner is refused")

	// Promote someone else and the same demotion is now allowed.
	other, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")
	require.Equal(t, http.StatusOK,
		adminCall(t, s, http.MethodPatch, "/admin/users/"+other.ID, `{"is_admin":true}`, owner).Code)
	require.Equal(t, http.StatusOK,
		adminCall(t, s, http.MethodPatch, "/admin/users/"+self.ID, `{"is_admin":false}`, owner).Code)
}

func TestAdminResetsAPasswordAndInvalidatesSessions(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	registerAndLogin(t, s, "member@example.com")
	target, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")

	const newPassword = "brand-new-password"
	rec := adminCall(t, s, http.MethodPost, "/admin/users/"+target.ID+"/password",
		`{"new_password":"`+newPassword+`"}`, owner)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	require.Equal(t, http.StatusUnauthorized,
		adminCall(t, s, http.MethodPost, "/auth/login",
			`{"email":"member@example.com","password":"`+testPassword+`"}`, "").Code,
		"the old password stops working")
	require.Equal(t, http.StatusOK,
		adminCall(t, s, http.MethodPost, "/auth/login",
			`{"email":"member@example.com","password":"`+newPassword+`"}`, "").Code)
}

func TestAdminDeletesAUser(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	registerAndLogin(t, s, "member@example.com")
	target, _ := findUser(listAdminUsers(t, s, owner), "member@example.com")

	rec := adminCall(t, s, http.MethodDelete, "/admin/users/"+target.ID, "", owner)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	users := listAdminUsers(t, s, owner)
	require.Len(t, users, 1)
	_, still := findUser(users, "member@example.com")
	require.False(t, still)

	require.Equal(t, http.StatusNotFound,
		adminCall(t, s, http.MethodDelete, "/admin/users/"+target.ID, "", owner).Code,
		"deleting it twice is a 404, not a silent success")
}

// Deleting yourself here would be a foot-gun with no undo, and the account
// screen already owns that action for the signed-in user.
func TestAdminCannotDeleteSelf(t *testing.T) {
	s := testServer(t)
	owner := registerAndLogin(t, s, "owner@example.com")
	self, _ := findUser(listAdminUsers(t, s, owner), "owner@example.com")

	rec := adminCall(t, s, http.MethodDelete, "/admin/users/"+self.ID, "", owner)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
