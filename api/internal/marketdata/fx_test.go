package marketdata

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGetFxRateIdentity(t *testing.T) {
	s := NewService(nil, NewYahooProvider())
	out, err := s.GetFxRate(context.Background(), "usd", "USD")
	require.NoError(t, err)
	require.Equal(t, 1.0, out.Rate)
	require.Equal(t, "identity", out.Provider)
}

func TestGetFxRateYahooPair(t *testing.T) {
	close := 7.8
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Contains(t, r.URL.Path, "USDHKD=X")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"chart": map[string]any{
				"result": []any{
					map[string]any{
						"timestamp": []int64{time.Now().Unix()},
						"indicators": map[string]any{
							"quote": []any{
								map[string]any{
									"close": []*float64{&close},
								},
							},
						},
					},
				},
			},
		})
	}))
	t.Cleanup(srv.Close)

	provider := &YahooProvider{
		Client:    srv.Client(),
		ChartBase: srv.URL,
	}
	svc := NewService(nil, provider)
	out, err := svc.GetFxRate(context.Background(), "USD", "HKD")
	require.NoError(t, err)
	require.InDelta(t, 7.8, out.Rate, 0.0001)
	require.Equal(t, "USD", out.From)
	require.Equal(t, "HKD", out.To)
	require.False(t, out.Cached)

	out2, err := svc.GetFxRate(context.Background(), "USD", "HKD")
	require.NoError(t, err)
	require.True(t, out2.Cached)
	require.InDelta(t, 7.8, out2.Rate, 0.0001)
}
