package api

import (
	"context"
	"database/sql"
	"encoding/json"
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
func sptr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	s := n.String
	return &s
}

// tradeDTO flattens sqlc's sql.Null* fields into JSON-friendly nullable values
// (a number or null), so clients see net_pnl: 200 rather than {Float64,Valid}.
type tradeDTO struct {
	ID              string      `json:"id"`
	AccountID       string      `json:"account_id"`
	Symbol          string      `json:"symbol"`
	InstrumentType  string      `json:"instrument_type"`
	Direction       string      `json:"direction"`
	Status          string      `json:"status"`
	OpenedAt        time.Time   `json:"opened_at"`
	ClosedAt        *time.Time  `json:"closed_at"`
	QtyOpened       float64     `json:"qty_opened"`
	QtyRemaining    float64     `json:"qty_remaining"`
	AvgEntryPrice   float64     `json:"avg_entry_price"`
	AvgExitPrice    *float64    `json:"avg_exit_price"`
	GrossPnl        *float64    `json:"gross_pnl"`
	FeesTotal       float64     `json:"fees_total"`
	NetPnl          *float64    `json:"net_pnl"`
	PnlCurrency     string      `json:"pnl_currency"`
	ReturnPct       *float64    `json:"return_pct"`
	TimeInTradeSecs *int64      `json:"time_in_trade_secs"`
	Notes           string      `json:"notes"`
	Tags            []store.Tag `json:"tags"`
	InitialRisk     *float64    `json:"initial_risk,omitempty"`
}

func toTradeDTO(t store.Trade, tags []store.Tag) tradeDTO {
	if tags == nil {
		tags = []store.Tag{}
	}
	return tradeDTO{
		ID: t.ID, AccountID: t.AccountID, Symbol: t.Symbol,
		InstrumentType: t.InstrumentType, Direction: t.Direction, Status: t.Status,
		OpenedAt: t.OpenedAt, ClosedAt: tptr(t.ClosedAt), QtyOpened: t.QtyOpened,
		QtyRemaining: t.QtyRemaining, AvgEntryPrice: t.AvgEntryPrice, AvgExitPrice: fptr(t.AvgExitPrice),
		GrossPnl: fptr(t.GrossPnl), FeesTotal: t.FeesTotal, NetPnl: fptr(t.NetPnl),
		PnlCurrency: t.PnlCurrency, ReturnPct: fptr(t.ReturnPct),
		TimeInTradeSecs: iptr(t.TimeInTradeSecs), Notes: t.Notes, Tags: tags,
	}
}

// executionDTO flattens sql.Null* and parses details JSON so clients get
// details: {option_right, strike, expiry} rather than {String, Valid}.
type executionDTO struct {
	ID             string            `json:"id"`
	UserID         string            `json:"user_id"`
	AccountID      string            `json:"account_id"`
	ExternalID     *string           `json:"external_id"`
	Symbol         string            `json:"symbol"`
	InstrumentType string            `json:"instrument_type"`
	Side           string            `json:"side"`
	Quantity       float64           `json:"quantity"`
	Price          float64           `json:"price"`
	Fees           float64           `json:"fees"`
	Commission     float64           `json:"commission"`
	ExecutedAt     time.Time         `json:"executed_at"`
	Multiplier     float64           `json:"multiplier"`
	Details        map[string]string `json:"details"`
	ImportBatchID  *string           `json:"import_batch_id"`
	DedupHash      string            `json:"dedup_hash"`
	CreatedAt      time.Time         `json:"created_at"`
}

func toExecutionDTO(e store.Execution) executionDTO {
	details := map[string]string{}
	if e.Details.Valid && e.Details.String != "" {
		_ = json.Unmarshal([]byte(e.Details.String), &details)
		if details == nil {
			details = map[string]string{}
		}
	}
	return executionDTO{
		ID: e.ID, UserID: e.UserID, AccountID: e.AccountID,
		ExternalID: sptr(e.ExternalID), Symbol: e.Symbol, InstrumentType: e.InstrumentType,
		Side: e.Side, Quantity: e.Quantity, Price: e.Price, Fees: e.Fees, Commission: e.Commission,
		ExecutedAt: e.ExecutedAt, Multiplier: e.Multiplier, Details: details,
		ImportBatchID: sptr(e.ImportBatchID), DedupHash: e.DedupHash, CreatedAt: e.CreatedAt,
	}
}

func toExecutionDTOs(rows []store.Execution) []executionDTO {
	out := make([]executionDTO, 0, len(rows))
	for _, e := range rows {
		out = append(out, toExecutionDTO(e))
	}
	return out
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
		if f.matchTrade(t) {
			out = append(out, t)
		}
	}
	return out, nil
}

// loadTrades fetches open and/or closed trades for the trade log / home page.
// Date filters default to opened_at (legacy). Pass date_basis=close to filter
// by closed_at so calendar / realized-day views stay consistent.
func (s *Server) loadTrades(ctx context.Context, userID string, f Filters) ([]store.Trade, error) {
	rows, err := s.deps.Store.ListTrades(ctx, store.ListTradesParams{
		UserID:    userID,
		AccountID: accountArg(f.AccountID),
		Status:    statusArg(f.Status),
	})
	if err != nil {
		return nil, err
	}
	out := rows[:0]
	for _, t := range rows {
		if f.matchListDate(t) && f.matchSideDuration(t) {
			out = append(out, t)
		}
	}
	return out, nil
}
