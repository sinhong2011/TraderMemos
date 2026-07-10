package api

import (
	"fmt"
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
	Status    string // "" = all, "open" | "closed"
}

// parseFilters reads the shared filter query params. Malformed from/to dates
// are an error (rather than silently ignored) so clients learn of the mistake.
func parseFilters(c echo.Context) (Filters, error) {
	var f Filters
	f.AccountID = c.QueryParam("account_id")
	f.Symbol = c.QueryParam("symbol")
	f.Status = c.QueryParam("status")
	if f.Status != "" && f.Status != "open" && f.Status != "closed" {
		return f, fmt.Errorf("invalid 'status' (want open|closed)")
	}
	if v := c.QueryParam("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, fmt.Errorf("invalid 'from' date (want RFC3339)")
		}
		f.From = &t
	}
	if v := c.QueryParam("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return f, fmt.Errorf("invalid 'to' date (want RFC3339)")
		}
		f.To = &t
	}
	return f, nil
}

// accountArg maps the account filter to the interface{} narg the store expects.
func accountArg(accountID string) interface{} {
	if accountID == "" {
		return nil
	}
	return accountID
}

func statusArg(status string) interface{} {
	if status == "" {
		return nil
	}
	return status
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

// matchOpened reports whether a trade passes symbol/date filters using opened_at.
func (f Filters) matchOpened(symbol string, openedAt time.Time) bool {
	if f.Symbol != "" && symbol != f.Symbol {
		return false
	}
	if f.From != nil && openedAt.Before(*f.From) {
		return false
	}
	if f.To != nil && openedAt.After(*f.To) {
		return false
	}
	return true
}
