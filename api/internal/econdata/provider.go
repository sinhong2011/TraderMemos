// Package econdata fetches macro economic-calendar events (CPI, NFP, rate
// decisions, …) from an external feed and caches them in the economic_events
// table, which doubles as the historical archive: free feeds only serve the
// current week, so rows are never evicted.
package econdata

import (
	"context"
	"time"
)

// Event is one calendar entry, normalized across providers.
type Event struct {
	Title    string
	Country  string // ISO currency code in the FairEconomy feed (USD, EUR, …)
	Impact   string // high | medium | low | holiday
	Time     time.Time
	Forecast string
	Previous string
	Actual   string
}

type Provider interface {
	Name() string
	FetchEvents(ctx context.Context) ([]Event, error)
}
