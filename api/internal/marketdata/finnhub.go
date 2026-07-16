package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// FinnhubProvider fetches intraday bars via Finnhub stock candles API.
type FinnhubProvider struct {
	APIKey string
	Client *http.Client
}

func NewFinnhubProvider(apiKey string) *FinnhubProvider {
	return &FinnhubProvider{
		APIKey: apiKey,
		Client: &http.Client{Timeout: 20 * time.Second},
	}
}

func (p *FinnhubProvider) Name() string { return "finnhub" }

func (p *FinnhubProvider) FetchBars(ctx context.Context, req Request) ([]Bar, error) {
	if p.APIKey == "" {
		return nil, fmt.Errorf("finnhub: missing API key")
	}
	symbol := chartSymbol(req)
	resolution, err := FinnhubResolution(req.Interval)
	if err != nil {
		return nil, err
	}
	from := req.From.Unix()
	to := req.To.Unix()
	if to <= from {
		to = from + 3600
	}

	q := url.Values{}
	q.Set("symbol", symbol)
	q.Set("resolution", resolution)
	q.Set("from", UnixString(req.From))
	q.Set("to", UnixString(req.To))

	u := "https://finnhub.io/api/v1/stock/candle?" + q.Encode()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("X-Finnhub-Token", p.APIKey)

	resp, err := p.Client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("finnhub candle: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var payload finnhubCandleResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if payload.Status != "ok" {
		return []Bar{}, nil
	}
	bars := make([]Bar, 0, len(payload.T))
	for i, ts := range payload.T {
		bars = append(bars, Bar{
			Time:   ts,
			Open:   payload.O[i],
			High:   payload.H[i],
			Low:    payload.L[i],
			Close:  payload.C[i],
			Volume: payload.V[i],
		})
	}
	_ = from
	_ = to
	return bars, nil
}

type finnhubCandleResponse struct {
	Status string    `json:"s"`
	T      []int64   `json:"t"`
	O      []float64 `json:"o"`
	H      []float64 `json:"h"`
	L      []float64 `json:"l"`
	C      []float64 `json:"c"`
	V      []float64 `json:"v"`
}
