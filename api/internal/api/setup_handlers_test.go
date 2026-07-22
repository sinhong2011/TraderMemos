package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServerRegistrationClosed(t *testing.T) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test-secret-at-least-32-chars!!")
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, false), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
	})
}

func testServerDevAuth(t *testing.T) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test-secret-at-least-32-chars!!")
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
		AllowDevAuth: true,
	})
}

func TestSetupStatusEmpty(t *testing.T) {
	s := testServerRegistrationClosed(t)
	rec := do(s, http.MethodGet, "/api/v1/setup/status", "", "")
	require.Equal(t, http.StatusOK, rec.Code)
	var st map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &st))
	require.Equal(t, true, st["needs_setup"])
	require.Equal(t, false, st["registration_open"])
	require.Equal(t, float64(0), st["user_count"])
}

func TestSetupCreatesOwnerAndLocksRegister(t *testing.T) {
	s := testServerRegistrationClosed(t)
	body := `{"email":"owner@x.com","password":"hunter2pass","account":{"name":"Main","base_currency":"USD","starting_balance":10000}}`
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/setup", body, ""))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var out struct {
		Access  string         `json:"access_token"`
		IsAdmin bool           `json:"is_admin"`
		Account map[string]any `json:"account"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.True(t, out.IsAdmin)
	require.NotEmpty(t, out.Access)
	require.Equal(t, "Main", out.Account["name"])

	rec = do(s, http.MethodGet, "/api/v1/setup/status", "", "")
	var st map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &st))
	require.Equal(t, false, st["needs_setup"])
	require.Equal(t, false, st["registration_open"])

	rec = do(s, http.MethodPost, "/api/v1/auth/register",
		`{"email":"other@x.com","password":"hunter2pass"}`, "")
	require.Equal(t, http.StatusForbidden, rec.Code)

	rec = do(s, http.MethodPost, "/api/v1/setup",
		`{"email":"second@x.com","password":"hunter2pass"}`, "")
	require.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegisterRejectsShortPassword(t *testing.T) {
	s := testServer(t)
	// bootstrap owner via setup
	_ = registerAndLogin(t, s, "owner@x.com")
	rec := do(s, http.MethodPost, "/api/v1/auth/register",
		`{"email":"short@x.com","password":"short"}`, "")
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDevEnsureResetsPassword(t *testing.T) {
	s := testServer(t)
	// First owner via setup with an old password shape.
	body := `{"email":"demo@tradermemos.app","password":"hunter2pass"}`
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/setup", body, ""))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	// Without AllowDevAuth the route 404s.
	rec = do(s, http.MethodPost, "/api/v1/auth/dev-ensure",
		`{"email":"demo@tradermemos.app","password":"hunter2pass"}`, "")
	require.Equal(t, http.StatusNotFound, rec.Code)

	s2 := testServerDevAuth(t)
	_ = registerAndLogin(t, s2, "demo@tradermemos.app")
	rec = do(s2, http.MethodPost, "/api/v1/auth/dev-ensure",
		`{"email":"demo@tradermemos.app","password":"newpass1234"}`, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s2, http.MethodPost, "/api/v1/auth/login",
		`{"email":"demo@tradermemos.app","password":"hunter2pass"}`, "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	rec = do(s2, http.MethodPost, "/api/v1/auth/login",
		`{"email":"demo@tradermemos.app","password":"newpass1234"}`, "")
	require.Equal(t, http.StatusOK, rec.Code)
}

