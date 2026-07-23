package marketdata

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/tradermemos/api/internal/store"
	"golang.org/x/sync/singleflight"
)

// Service resolves bar requests with in-memory LRU, SQLite cache, and provider fetch.
type Service struct {
	Store    store.Querier
	Provider Provider
	mem      *memCache
	group    singleflight.Group
	fxMem    *fxCache
	fxGroup  singleflight.Group
}

func NewService(q store.Querier, provider Provider) *Service {
	return &Service{
		Store:    q,
		Provider: provider,
		mem:      newMemCache(128),
		fxMem:    newFxCache(),
	}
}

func (s *Service) GetBars(ctx context.Context, req Request) (Response, error) {
	if s.Provider == nil {
		return Response{}, errors.New("market data provider not configured")
	}
	key := CacheKey(req)
	if bars, ok := s.mem.get(key); ok {
		return Response{
			Symbol:   req.Symbol,
			Interval: req.Interval,
			From:     FormatTimeRFC3339(req.From),
			To:       FormatTimeRFC3339(req.To),
			Provider: s.Provider.Name(),
			Cached:   true,
			Bars:     bars,
		}, nil
	}

	v, err, _ := s.group.Do(key, func() (any, error) {
		return s.fetchBars(ctx, req, key)
	})
	if err != nil {
		return Response{}, err
	}
	return v.(Response), nil
}

func (s *Service) fetchBars(ctx context.Context, req Request, key string) (Response, error) {
	if bars, ok := s.mem.get(key); ok {
		return Response{
			Symbol: req.Symbol, Interval: req.Interval,
			From: FormatTimeRFC3339(req.From), To: FormatTimeRFC3339(req.To),
			Provider: s.Provider.Name(), Cached: true, Bars: bars,
		}, nil
	}

	cached, err := s.Store.GetMarketBarsCache(ctx, key)
	if err == nil {
		if cached.ExpiresAt.Valid {
			exp, perr := time.Parse(time.RFC3339, cached.ExpiresAt.String)
			if perr == nil && time.Now().UTC().After(exp) {
				goto fetch
			}
		}
		var bars []Bar
		if uerr := json.Unmarshal(cached.BarsJson, &bars); uerr == nil {
			s.mem.set(key, bars)
			return Response{
				Symbol: req.Symbol, Interval: req.Interval,
				From: FormatTimeRFC3339(req.From), To: FormatTimeRFC3339(req.To),
				Provider: cached.Provider, Cached: true, Bars: bars,
			}, nil
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Response{}, err
	}

fetch:
	bars, err := s.Provider.FetchBars(ctx, req)
	if err != nil {
		return Response{}, err
	}
	raw, err := json.Marshal(bars)
	if err != nil {
		return Response{}, err
	}
	expires := cacheExpiresAt(req.To)
	var expiresSQL sql.NullString
	if expires != nil {
		expiresSQL = sql.NullString{String: expires.UTC().Format(time.RFC3339), Valid: true}
	}
	if err := s.Store.UpsertMarketBarsCache(ctx, store.UpsertMarketBarsCacheParams{
		CacheKey:  key,
		Symbol:    req.Symbol,
		Interval:  req.Interval,
		FromTs:    FormatTimeRFC3339(req.From),
		ToTs:      FormatTimeRFC3339(req.To),
		BarsJson:  raw,
		Provider:  s.Provider.Name(),
		FetchedAt: time.Now().UTC().Format(time.RFC3339),
		ExpiresAt: expiresSQL,
	}); err != nil {
		return Response{}, err
	}
	s.mem.set(key, bars)
	return Response{
		Symbol: req.Symbol, Interval: req.Interval,
		From: FormatTimeRFC3339(req.From), To: FormatTimeRFC3339(req.To),
		Provider: s.Provider.Name(), Cached: false, Bars: bars,
	}, nil
}

func cacheExpiresAt(to time.Time) *time.Time {
	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if to.Before(startOfToday) {
		return nil
	}
	t := now.Add(5 * time.Minute)
	return &t
}

type memCache struct {
	mu    sync.RWMutex
	max   int
	order []string
	data  map[string][]Bar
}

func newMemCache(max int) *memCache {
	if max < 1 {
		max = 64
	}
	return &memCache{max: max, data: make(map[string][]Bar)}
}

func (c *memCache) get(key string) ([]Bar, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	bars, ok := c.data[key]
	if !ok {
		return nil, false
	}
	out := make([]Bar, len(bars))
	copy(out, bars)
	return out, true
}

func (c *memCache) set(key string, bars []Bar) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.data[key]; !exists {
		c.order = append(c.order, key)
	}
	cp := make([]Bar, len(bars))
	copy(cp, bars)
	c.data[key] = cp
	for len(c.order) > c.max {
		oldest := c.order[0]
		c.order = c.order[1:]
		delete(c.data, oldest)
	}
}

// NewProvider picks a market data provider from config.
func NewProvider(providerName, apiKey string) Provider {
	switch providerName {
	case "finnhub":
		if apiKey != "" {
			return NewFinnhubProvider(apiKey)
		}
		return NewYahooProvider()
	case "yahoo", "":
		return NewYahooProvider()
	default:
		if apiKey != "" {
			return NewFinnhubProvider(apiKey)
		}
		return NewYahooProvider()
	}
}
