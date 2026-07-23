package api_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
)

// closedTradeID creates a closed AAPL trade for the token's user and returns its id.
func closedTradeID(t *testing.T, s *api.Server, token, acc string) string {
	t.Helper()
	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-01T11:00:00Z"}`
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", buy, token).Code)
	require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", sell, token).Code)
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", token)
	var trs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trs))
	require.Len(t, trs, 1)
	return trs[0]["id"].(string)
}

// imageUploadReq builds a multipart request whose file part declares image/png.
func imageUploadReq(t *testing.T, path, token string, data []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", `form-data; name="file"; filename="chart.png"`)
	h.Set("Content-Type", "image/png")
	fw, err := w.CreatePart(h)
	require.NoError(t, err)
	_, _ = fw.Write(data)
	require.NoError(t, w.Close())
	r := httptest.NewRequest(http.MethodPost, path, &buf)
	r.Header.Set("Content-Type", w.FormDataContentType())
	r.Header.Set("Authorization", "Bearer "+token)
	return r
}

func TestAttachmentLifecycleAndIsolation(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "att@x.com")
	tokB := registerAndLogin(t, s, "attb@x.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	// Minimal 1×1 PNG (magic-byte sniff must accept real image bytes).
	png1x1 := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
		0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
		0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
		0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
	}

	// upload
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, imageUploadReq(t, "/api/v1/trades/"+tradeID+"/attachments", tok, png1x1))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var att struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &att))
	require.NotEmpty(t, att.ID)

	// list shows 1
	rec = do(s, http.MethodGet, "/api/v1/trades/"+tradeID+"/attachments", "", tok)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list, 1)

	// file returns the bytes
	rec = do(s, http.MethodGet, "/api/v1/attachments/"+att.ID+"/file", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, png1x1, rec.Body.Bytes())

	// another user cannot read the file
	rec = do(s, http.MethodGet, "/api/v1/attachments/"+att.ID+"/file", "", tokB)
	require.Equal(t, http.StatusNotFound, rec.Code)

	// delete
	rec = do(s, http.MethodDelete, "/api/v1/attachments/"+att.ID, "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/attachments/"+att.ID+"/file", "", tok)
	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAttachmentRejectsNonImage(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "att2@x.com")
	acc := accountID(t, s, tok)
	tradeID := closedTradeID(t, s, tok, acc)

	// use the octet-stream multipart helper (non-image content type)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartReq(t, "/api/v1/trades/"+tradeID+"/attachments", tok, "notanimage", nil))
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
