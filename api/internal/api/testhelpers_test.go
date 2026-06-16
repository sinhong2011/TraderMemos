package api_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServer(t *testing.T) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
	})
}

// registerAndLogin creates a user and returns its access token.
func registerAndLogin(t *testing.T, s *api.Server, email string) string {
	t.Helper()
	body := `{"email":"` + email + `","password":"hunter2"}`
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/register", body, ""))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login", body, ""))
	require.Equal(t, http.StatusOK, rec.Code)
	var toks struct {
		Access string `json:"access_token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &toks))
	require.NotEmpty(t, toks.Access)
	return toks.Access
}

func jsonReq(method, path, body, token string) *http.Request {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

// do executes an authenticated JSON request and returns the recorder.
func do(s *api.Server, method, path, body, token string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(method, path, body, token))
	return rec
}

// multipartReq builds a multipart request with a CSV file + extra fields.
func multipartReq(t *testing.T, path, token, csvBody string, fields map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", "trades.csv")
	require.NoError(t, err)
	_, _ = fw.Write([]byte(csvBody))
	for k, v := range fields {
		require.NoError(t, w.WriteField(k, v))
	}
	require.NoError(t, w.Close())
	r := httptest.NewRequest(http.MethodPost, path, &buf)
	r.Header.Set("Content-Type", w.FormDataContentType())
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}
