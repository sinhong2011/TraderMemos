package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/ocr"
	"github.com/tradermemos/api/internal/storage"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServerWithOCR(t *testing.T, vision ocr.VisionConfig) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")
	market := marketdata.NewService(q, marketdata.NewYahooProvider())
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j, true), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
		OCRMaxBytes: 10 << 20,
		Market:      market,
		OCR: ocr.NewService(vision, func(ctx context.Context) (ocr.VisionConfig, bool, error) {
			return api.LoadOcrVisionOverlay(ctx, q)
		}),
	})
}

func TestOCRParse_prefillsExtract(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{
				map[string]any{
					"message": map[string]any{
						"content": `{"symbol":"AAPL","instrument_type":"stock","side":"long","rows":[{"symbol":"AAPL","side":"buy","quantity":10,"price":185.5,"fees":1}],"warnings":[]}`,
					},
				},
			},
		})
	}))
	defer srv.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	})
	tok := registerAndLogin(t, s, "ocr@example.com")

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", "fill.png")
	require.NoError(t, err)
	_, err = fw.Write([]byte("fake-png-bytes"))
	require.NoError(t, err)
	require.NoError(t, w.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ocr/parse", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var out ocr.TradeExtract
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Equal(t, "AAPL", out.Symbol)
	require.Equal(t, "long", out.Side)
	require.Len(t, out.Rows, 1)
	require.Equal(t, "buy", out.Rows[0].Side)
	require.Equal(t, 10.0, out.Rows[0].Quantity)
	require.Equal(t, 185.50, out.Rows[0].Price)
}

func TestOCRParse_unavailableWithoutReadyConfig(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "ocr-off@example.com")

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", "fill.png")
	require.NoError(t, err)
	_, err = fw.Write([]byte("fake"))
	require.NoError(t, err)
	require.NoError(t, w.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ocr/parse", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}

func TestOCRParse_surfacesUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("Hello from gateway"))
	}))
	defer srv.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{
		Enabled: true, BaseURL: srv.URL, APIKey: "k", HTTPClient: srv.Client(),
	})
	tok := registerAndLogin(t, s, "ocr-err@example.com")

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", "fill.png")
	require.NoError(t, err)
	_, err = fw.Write([]byte("fake"))
	require.NoError(t, err)
	require.NoError(t, w.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ocr/parse", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.Contains(t, rec.Body.String(), "ocr_failed")
	require.Contains(t, rec.Body.String(), "Hello from gateway")
}

func TestOCRSettings_roundTripAndMask(t *testing.T) {
	s := testServerWithOCR(t, ocr.VisionConfig{
		Enabled: false,
		BaseURL: "https://api.openai.com/v1",
		Model:   "gpt-4o-mini",
	})
	tok := registerAndLogin(t, s, "ocr-settings@example.com")

	rec := do(s, http.MethodGet, "/api/v1/settings/ocr", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, false, got["enabled"])
	require.Equal(t, false, got["api_key_set"])

	body := `{"enabled":true,"base_url":"https://vision.example/v1","model":"gpt-4o-mini","api_key":"sk-secret-key-9999"}`
	rec = do(s, http.MethodPut, "/api/v1/settings/ocr", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["enabled"])
	require.Equal(t, true, got["api_key_set"])
	require.Equal(t, "…9999", got["api_key_hint"])
	require.NotContains(t, rec.Body.String(), "sk-secret-key-9999")

	// Empty api_key keeps existing.
	body = `{"enabled":true,"base_url":"https://vision.example/v1","model":"gpt-4o","api_key":""}`
	rec = do(s, http.MethodPut, "/api/v1/settings/ocr", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "gpt-4o", got["model"])
	require.Equal(t, true, got["api_key_set"])
	require.Equal(t, "…9999", got["api_key_hint"])
}

func TestOCRSettings_testConnection(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models" {
			t.Fatalf("path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []any{map[string]any{"id": "gpt-4o-mini"}},
		})
	}))
	defer srv.Close()

	s := testServerWithOCR(t, ocr.VisionConfig{})
	tok := registerAndLogin(t, s, "ocr-test@example.com")

	body := `{"base_url":"` + srv.URL + `","model":"gpt-4o-mini","api_key":"k"}`
	rec := do(s, http.MethodPost, "/api/v1/settings/ocr/test", body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, true, got["ok"])
}
