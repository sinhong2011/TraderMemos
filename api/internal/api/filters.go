package api

import (
	"time"

	"github.com/labstack/echo/v4"
)

// Filters is the shared query-param filter set used by trades + analytics.
// Account filtering is pushed to SQL; symbol/date filtering is applied in Go
// to avoid timestamp-binding fragility across the sqlite driver.
type Filters struct {
	AccountID string // "" = all accounts
	From      *time.Time
	To        *time.Time
	Symbol    string
}

func parseFilters(c echo.Context) Filters {
	var f Filters
	f.AccountID = c.QueryParam("account_id")
	f.Symbol = c.QueryParam("symbol")
	if v := c.QueryParam("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.From = &t
		}
	}
	if v := c.QueryParam("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.To = &t
		}
	}
	return f
}

// accountArg maps the account filter to the interface{} narg the store expects.
func accountArg(accountID string) interface{} {
	if accountID == "" {
		return nil
	}
	return accountID
}

// matchClosed reports whether a closed trade passes the symbol/date filters.
func (f Filters) matchClosed(symbol string, closedAt time.Time) bool {
	if f.Symbol != "" && symbol != f.Symbol {
		return false
	}
	if f.From != nil && closedAt.Before(*f.From) {
		return false
	}
	if f.To != nil && closedAt.After(*f.To) {
		return false
	}
	return true
}
