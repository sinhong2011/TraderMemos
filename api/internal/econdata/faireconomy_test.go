package econdata

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

const feedFixture = `[
  {"title":"CPI y/y","country":"USD","date":"2026-08-04T08:30:00-04:00","impact":"High","forecast":"2.9%","previous":"3.0%"},
  {"title":"Bank Holiday","country":"CAD","date":"2026-08-03T00:00:00-04:00","impact":"Holiday","forecast":"","previous":""},
  {"title":"Fed Chair Speaks","country":"USD","date":"2026-08-05T14:00:00-04:00","impact":"Medium","forecast":"","previous":""},
  {"title":"Broken Date","country":"EUR","date":"not-a-date","impact":"Low","forecast":"","previous":""},
  {"title":"German Factory Orders m/m","country":"eur","date":"2026-08-06T02:00:00-04:00","impact":"","forecast":"1.0%","previous":"-1.4%"}
]`

func TestFairEconomyFetchEvents(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "TraderMemos/1.0", r.Header.Get("User-Agent"))
		_, _ = w.Write([]byte(feedFixture))
	}))
	defer srv.Close()

	p := NewFairEconomyProvider(srv.URL)
	events, err := p.FetchEvents(context.Background())
	require.NoError(t, err)
	require.Len(t, events, 4) // broken date skipped

	require.Equal(t, "CPI y/y", events[0].Title)
	require.Equal(t, "USD", events[0].Country)
	require.Equal(t, "high", events[0].Impact)
	require.Equal(t, "2.9%", events[0].Forecast)
	require.Equal(t, "2026-08-04T12:30:00Z", events[0].Time.UTC().Format("2006-01-02T15:04:05Z"))

	require.Equal(t, "holiday", events[1].Impact)
	require.Equal(t, "medium", events[2].Impact)
	// Unknown/empty impact degrades to low; country is uppercased.
	require.Equal(t, "low", events[3].Impact)
	require.Equal(t, "EUR", events[3].Country)
}

func TestFairEconomyFetchEventsUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer srv.Close()

	p := NewFairEconomyProvider(srv.URL)
	_, err := p.FetchEvents(context.Background())
	require.Error(t, err)
	require.Contains(t, err.Error(), "rate limited")
}
