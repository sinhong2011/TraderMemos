package econdata

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/tradermemos/api/internal/store"
	"golang.org/x/sync/singleflight"
)

// Service refreshes the economic_events table from the provider on demand.
// Freshness is tracked via the stored fetched_at values, so restarts do not
// trigger extra feed downloads.
type Service struct {
	Store    store.Querier
	Provider Provider
	// TTL is how old the cached feed may be before a request triggers a
	// re-fetch. Zero means the 1h default.
	TTL   time.Duration
	group singleflight.Group
}

func NewService(q store.Querier, provider Provider) *Service {
	return &Service{Store: q, Provider: provider}
}

func (s *Service) ttl() time.Duration {
	if s.TTL > 0 {
		return s.TTL
	}
	return time.Hour
}

// EnsureFresh re-fetches the feed when the stored copy is older than TTL.
// Concurrent callers collapse into one fetch. Callers should treat an error
// as degraded (serve cached rows), not fatal.
func (s *Service) EnsureFresh(ctx context.Context) error {
	if s.Provider == nil {
		return errors.New("economic calendar provider not configured")
	}
	_, err, _ := s.group.Do("refresh", func() (any, error) {
		last, err := s.Store.GetEconomicEventsLastFetch(ctx, s.Provider.Name())
		if err == nil {
			if t, perr := time.Parse(time.RFC3339, last); perr == nil && time.Since(t) < s.ttl() {
				return nil, nil
			}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		return nil, s.refresh(ctx)
	})
	return err
}

func (s *Service) refresh(ctx context.Context) error {
	events, err := s.Provider.FetchEvents(ctx)
	if err != nil {
		return err
	}
	// An empty payload is more likely a feed hiccup than an empty week —
	// keep existing rows rather than wiping the future.
	if len(events) == 0 {
		return nil
	}

	now := time.Now().UTC()
	fetchedAt := now.Format(time.RFC3339)

	// Rescheduled events change their natural key (event_ts), which would
	// leave a stale duplicate behind. The feed is authoritative for the
	// future, so replace all future rows; past rows are history and are
	// only ever updated in place by the upsert below.
	if err := s.Store.DeleteFutureEconomicEvents(ctx, store.DeleteFutureEconomicEventsParams{
		Provider: s.Provider.Name(),
		EventTs:  now.Format(time.RFC3339),
	}); err != nil {
		return err
	}

	for _, ev := range events {
		if err := s.Store.UpsertEconomicEvent(ctx, store.UpsertEconomicEventParams{
			Provider:  s.Provider.Name(),
			Title:     ev.Title,
			Country:   ev.Country,
			Impact:    ev.Impact,
			EventTs:   ev.Time.UTC().Format(time.RFC3339),
			Forecast:  ev.Forecast,
			Previous:  ev.Previous,
			Actual:    ev.Actual,
			FetchedAt: fetchedAt,
		}); err != nil {
			return err
		}
	}
	return nil
}
