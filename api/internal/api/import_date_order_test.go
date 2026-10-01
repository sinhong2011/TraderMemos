package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Every date fits both orders differently, so only the user can settle it.
const ambiguousDatesCSV = `Symbol,Side,Qty,Price,Time
0700,Buy,100,400,05/01/2026 09:30:00
0700,Sell,100,410,06/01/2026 15:59:00
`

func TestImportAmbiguousDateOrderRoundTrip(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "date-order@x.com")
	acc := accountID(t, s, tok)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "fills.csv",
		ambiguousDatesCSV, map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview struct {
		DateOrder struct {
			Order             string `json:"order"`
			Example           string `json:"example"`
			ExampleMonthFirst string `json:"example_month_first"`
			ExampleDayFirst   string `json:"example_day_first"`
		} `json:"date_order"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.Equal(t, "ambiguous", preview.DateOrder.Order)
	require.Equal(t, "05/01/2026 09:30:00", preview.DateOrder.Example)
	require.Equal(t, "2026-05-01", preview.DateOrder.ExampleMonthFirst)
	require.Equal(t, "2026-01-05", preview.DateOrder.ExampleDayFirst)

	mapping := `{"symbol":"Symbol","side":"Side","quantity":"Qty","price":"Price","executed_at":"Time"}`

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "fills.csv",
		ambiguousDatesCSV, map[string]string{
			"account_id": acc, "column_mapping": mapping, "source_tz": "UTC", "date_order": "sideways",
		}))
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports/commit", tok, "fills.csv",
		ambiguousDatesCSV, map[string]string{
			"account_id": acc, "column_mapping": mapping, "source_tz": "UTC", "date_order": "day_first",
		}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	var trades []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 1)
	require.Equal(t, "2026-01-05T09:30:00Z", trades[0]["opened_at"])
	require.Equal(t, "2026-01-06T15:59:00Z", trades[0]["closed_at"])
}

// A file without slash dates says nothing about order, so the client shows no picker.
func TestImportPreviewOmitsDateOrderWithoutSlashDates(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "iso-dates@x.com")
	acc := accountID(t, s, tok)

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, multipartFileReq(t, "/api/v1/imports", tok, "fills.csv",
		"Symbol,Side,Qty,Price,Time\nAAPL,Buy,1,100,2026-01-05 09:30:00\n",
		map[string]string{"account_id": acc}))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var preview map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &preview))
	require.NotContains(t, preview, "date_order")
}
