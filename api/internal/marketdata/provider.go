package marketdata

import "context"

// Provider fetches OHLCV bars from an external market data source.
type Provider interface {
	Name() string
	FetchBars(ctx context.Context, req Request) ([]Bar, error)
}
