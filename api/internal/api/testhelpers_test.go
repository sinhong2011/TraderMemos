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
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServer(t *testing.T) *api.Server {
	t.Helper()
	return testServerWithRegistration(t, true)
}

// testServerWithRegistration builds a server with open sign-up on or off — the
// shipped default is off, which is what the admin routes have to work against.
func testServerWithRegistration(t *testing.T, allowRegistration bool) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	// NewForDriver (not store.New) so handlers exercise the TxRunner path.
	q := store.NewForDriver(conn, "sqlite")
	j := auth.NewJWT("test")
	provider := marketdata.NewYahooProvider()
	market := marketdata.NewService(q, provider)
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, allowRegistration), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
		Market: market,
	})
}

const testPassword = "hunter2pass"

// registerAndLogin creates a user and returns its access token.
// The first user on an empty DB goes through /setup; later users use /auth/register.
func registerAndLogin(t *testing.T, s *api.Server, email string) string {
	t.Helper()
	body := `{"email":"` + email + `","password":"` + testPassword + `"}`

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/setup", body, ""))
	if rec.Code == http.StatusCreated {
		var out struct {
			Access string `json:"access_token"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		require.NotEmpty(t, out.Access)
		return out.Access
	}

	rec = httptest.NewRecorder()
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
	return multipartFileReq(t, path, token, "trades.csv", csvBody, fields)
}

func multipartFileReq(t *testing.T, path, token, filename, body string, fields map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, _ = fw.Write([]byte(body))
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
