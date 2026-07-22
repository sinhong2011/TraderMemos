package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// FxRateResponse is the API payload for GET /market/fx.
// Rate means: 1 From = Rate To.
type FxRateResponse struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	Rate     float64 `json:"rate"`
	AsOf     string  `json:"as_of"`
	Provider string  `json:"provider"`
	Cached   bool    `json:"cached"`
}

type fxCacheEntry struct {
	rate    float64
	asOf    time.Time
	expires time.Time
}

const fxCacheTTL = 15 * time.Minute

type fxCache struct {
	mu   sync.RWMutex
	data map[string]fxCacheEntry
}

func newFxCache() *fxCache {
	return &fxCache{data: make(map[string]fxCacheEntry)}
}

func (c *fxCache) get(key string) (fxCacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.data[key]
	if !ok || time.Now().UTC().After(e.expires) {
		return fxCacheEntry{}, false
	}
	return e, true
}

func (c *fxCache) set(key string, rate float64, asOf time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = fxCacheEntry{
		rate:    rate,
		asOf:    asOf,
		expires: time.Now().UTC().Add(fxCacheTTL),
	}
}

// GetFxRate returns the latest FX rate converting 1 from → to units.
func (s *Service) GetFxRate(ctx context.Context, from, to string) (FxRateResponse, error) {
	from = normalizeCurrency(from)
	to = normalizeCurrency(to)
	if from == "" || to == "" {
		return FxRateResponse{}, fmt.Errorf("from and to currencies are required")
	}
	if from == to {
		now := time.Now().UTC()
		return FxRateResponse{
			From: from, To: to, Rate: 1,
			AsOf: FormatTimeRFC3339(now), Provider: "identity", Cached: true,
		}, nil
	}
	if s.Provider == nil {
		return FxRateResponse{}, fmt.Errorf("market data provider not configured")
	}

	if s.fxMem == nil {
		s.fxMem = newFxCache()
	}
	key := from + ">" + to
	if e, ok := s.fxMem.get(key); ok {
		return FxRateResponse{
			From: from, To: to, Rate: e.rate,
			AsOf: FormatTimeRFC3339(e.asOf), Provider: s.Provider.Name(), Cached: true,
		}, nil
	}

	v, err, _ := s.fxGroup.Do(key, func() (any, error) {
		if e, ok := s.fxMem.get(key); ok {
			return FxRateResponse{
				From: from, To: to, Rate: e.rate,
				AsOf: FormatTimeRFC3339(e.asOf), Provider: s.Provider.Name(), Cached: true,
			}, nil
		}
		rate, asOf, err := fetchYahooFxRate(ctx, asYahoo(s.Provider), from, to)
		if err != nil {
			return FxRateResponse{}, err
		}
		s.fxMem.set(key, rate, asOf)
		if rate > 0 {
			s.fxMem.set(to+">"+from, 1/rate, asOf)
		}
		return FxRateResponse{
			From: from, To: to, Rate: rate,
			AsOf: FormatTimeRFC3339(asOf), Provider: s.Provider.Name(), Cached: false,
		}, nil
	})
	if err != nil {
		return FxRateResponse{}, err
	}
	return v.(FxRateResponse), nil
}

func normalizeCurrency(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func asYahoo(p Provider) *YahooProvider {
	if y, ok := p.(*YahooProvider); ok {
		return y
	}
	return NewYahooProvider()
}

// fetchYahooFxRate reads Yahoo's FX chart pair FROMTO=X (or inverse).
func fetchYahooFxRate(ctx context.Context, p *YahooProvider, from, to string) (float64, time.Time, error) {
	if p == nil {
		p = NewYahooProvider()
	}
	rate, asOf, err := yahooFxPair(ctx, p, from+to)
	if err == nil && rate > 0 {
		return rate, asOf, nil
	}
	inv, asOf, invErr := yahooFxPair(ctx, p, to+from)
	if invErr == nil && inv > 0 {
		return 1 / inv, asOf, nil
	}
	if err != nil {
		return 0, time.Time{}, err
	}
	return 0, time.Time{}, invErr
}

func yahooFxPair(ctx context.Context, p *YahooProvider, pair string) (float64, time.Time, error) {
	symbol := strings.ToUpper(pair) + "=X"
	to := time.Now().UTC()
	from := to.Add(-72 * time.Hour)
	u := fmt.Sprintf(
		"%s/v8/finance/chart/%s?interval=1d&period1=%d&period2=%d",
		p.chartBase(),
		url.PathEscape(symbol),
		from.Unix(),
		to.Unix(),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, time.Time{}, err
	}
	req.Header.Set("User-Agent", "TraderMemos/1.0")

	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, time.Time{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return 0, time.Time{}, fmt.Errorf("yahoo fx %s: %s %s", symbol, resp.Status, strings.TrimSpace(string(body)))
	}

	var payload yahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, time.Time{}, err
	}
	if payload.Chart.Error != nil {
		return 0, time.Time{}, fmt.Errorf("yahoo fx %s: %s", symbol, payload.Chart.Error.Description)
	}
	if len(payload.Chart.Result) == 0 {
		return 0, time.Time{}, fmt.Errorf("yahoo fx %s: empty result", symbol)
	}
	result := payload.Chart.Result[0]
	if len(result.Indicators.Quote) == 0 {
		return 0, time.Time{}, fmt.Errorf("yahoo fx %s: no quote", symbol)
	}
	closes := result.Indicators.Quote[0].Close
	var rate float64
	var ts int64
	for i := len(closes) - 1; i >= 0; i-- {
		if closes[i] != nil && *closes[i] > 0 {
			rate = *closes[i]
			if i < len(result.Timestamp) {
				ts = result.Timestamp[i]
			}
			break
		}
	}
	if rate <= 0 {
		return 0, time.Time{}, fmt.Errorf("yahoo fx %s: no close", symbol)
	}
	asOf := time.Now().UTC()
	if ts > 0 {
		asOf = time.Unix(ts, 0).UTC()
	}
	return rate, asOf, nil
}
