package api

import (
	"context"
	"database/sql"
	"time"

	"github.com/tradermemos/api/internal/store"
)

func fptr(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	return &n.Float64
}
func tptr(n sql.NullTime) *time.Time {
	if !n.Valid {
		return nil
	}
	return &n.Time
}
func iptr(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	return &n.Int64
}

// tradeDTO flattens sqlc's sql.Null* fields into JSON-friendly nullable values
// (a number or null), so clients see net_pnl: 200 rather than {Float64,Valid}.
type tradeDTO struct {
	ID              string     `json:"id"`
	AccountID       string     `json:"account_id"`
	Symbol          string     `json:"symbol"`
	InstrumentType  string     `json:"instrument_type"`
	Direction       string     `json:"direction"`
	Status          string     `json:"status"`
	OpenedAt        time.Time  `json:"opened_at"`
	ClosedAt        *time.Time `json:"closed_at"`
	QtyOpened       float64    `json:"qty_opened"`
	AvgEntryPrice   float64    `json:"avg_entry_price"`
	AvgExitPrice    *float64   `json:"avg_exit_price"`
	GrossPnl        *float64   `json:"gross_pnl"`
	FeesTotal       float64    `json:"fees_total"`
	NetPnl          *float64   `json:"net_pnl"`
	PnlCurrency     string     `json:"pnl_currency"`
	ReturnPct       *float64   `json:"return_pct"`
	TimeInTradeSecs *int64     `json:"time_in_trade_secs"`
	Notes           string     `json:"notes"`
	Tags            []store.Tag `json:"tags"`
}

func toTradeDTO(t store.Trade, tags []store.Tag) tradeDTO {
	if tags == nil {
		tags = []store.Tag{}
	}
	return tradeDTO{
		ID: t.ID, AccountID: t.AccountID, Symbol: t.Symbol,
		InstrumentType: t.InstrumentType, Direction: t.Direction, Status: t.Status,
		OpenedAt: t.OpenedAt, ClosedAt: tptr(t.ClosedAt), QtyOpened: t.QtyOpened,
		AvgEntryPrice: t.AvgEntryPrice, AvgExitPrice: fptr(t.AvgExitPrice),
		GrossPnl: fptr(t.GrossPnl), FeesTotal: t.FeesTotal, NetPnl: fptr(t.NetPnl),
		PnlCurrency: t.PnlCurrency, ReturnPct: fptr(t.ReturnPct),
		TimeInTradeSecs: iptr(t.TimeInTradeSecs), Notes: t.Notes, Tags: tags,
	}
}

// loadClosedTrades fetches a user's closed trades (optionally account-scoped in
// SQL) and applies symbol/date filters in Go.
func (s *Server) loadClosedTrades(ctx context.Context, userID string, f Filters) ([]store.Trade, error) {
	rows, err := s.deps.Store.ListClosedTrades(ctx, store.ListClosedTradesParams{
		UserID:    userID,
		AccountID: accountArg(f.AccountID),
	})
	if err != nil {
		return nil, err
	}
	out := rows[:0]
	for _, t := range rows {
		if t.ClosedAt.Valid && f.matchClosed(t.Symbol, t.ClosedAt.Time) {
			out = append(out, t)
		}
	}
	return out, nil
}
