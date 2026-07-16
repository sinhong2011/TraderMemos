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

type stubOCRProvider struct {
	text string
	err  error
}

func (s stubOCRProvider) Name() string { return "stub" }

func (s stubOCRProvider) ExtractText(_ context.Context, _ []byte, _ string) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return s.text, nil
}

func testServerWithOCR(t *testing.T, provider ocr.Provider) *api.Server {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")
	market := marketdata.NewService(q, marketdata.NewYahooProvider())
	return api.New(api.Deps{
		JWT: j, Auth: auth.NewService(q, j), Store: q, Trades: trades.NewService(q),
		Storage: storage.NewLocalDisk(filepath.Join(t.TempDir(), "attach")), AttachMaxBytes: 10 << 20,
		OCRMaxBytes: 10 << 20,
		Market:      market,
		OCR:         ocr.NewService(provider),
	})
}

func TestOCRParse_prefillsExtract(t *testing.T) {
	s := testServerWithOCR(t, stubOCRProvider{text: `Symbol: AAPL
BUY 10 @ 185.50
Commission: 1.00
2024-01-15 10:30:00
`})
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

func TestOCRParse_unavailableWithoutService(t *testing.T) {
	s := testServer(t)
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
