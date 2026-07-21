package api

import (
	"fmt"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/store"
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
	Side      string // "" = all, "long" | "short"
	Duration  string // "" = all, "scalp" | "day" | "swing"
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
	f.Side = c.QueryParam("side")
	if f.Side != "" && f.Side != "long" && f.Side != "short" {
		return f, fmt.Errorf("invalid 'side' (want long|short)")
	}
	f.Duration = c.QueryParam("duration")
	if f.Duration != "" && f.Duration != "scalp" && f.Duration != "day" && f.Duration != "swing" {
		return f, fmt.Errorf("invalid 'duration' (want scalp|day|swing)")
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

// matchSideDuration applies the Side/Duration filters to a trade. Open trades
// (no valid close) pass the Side check but fail any Duration filter, since a
// holding-period bucket requires a close.
func (f Filters) matchSideDuration(t store.Trade) bool {
	if f.Side == "long" && t.Direction != "long" {
		return false
	}
	if f.Side == "short" && t.Direction != "short" {
		return false
	}
	if f.Duration != "" {
		if !t.ClosedAt.Valid {
			return false
		}
		var secs *int64
		if t.TimeInTradeSecs.Valid {
			v := t.TimeInTradeSecs.Int64
			secs = &v
		}
		if analytics.DurationBucket(t.OpenedAt, t.ClosedAt.Time, secs) != f.Duration {
			return false
		}
	}
	return true
}

// matchTrade layers Side/Duration (and the existing symbol/date checks) onto a
// closed trade. Trades without a valid close are excluded.
func (f Filters) matchTrade(t store.Trade) bool {
	if !t.ClosedAt.Valid || !f.matchClosed(t.Symbol, t.ClosedAt.Time) {
		return false
	}
	return f.matchSideDuration(t)
}
