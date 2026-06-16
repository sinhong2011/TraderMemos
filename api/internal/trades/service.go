package trades

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
)

type Service struct{ q *store.Queries }

func NewService(q *store.Queries) *Service { return &Service{q: q} }

// Regroup rebuilds all trades for an account from its executions. Idempotent.
func (s *Service) Regroup(ctx context.Context, userID, accountID string) error {
	acc, err := s.q.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
	if err != nil {
		return err
	}

	rows, err := s.q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return err
	}
	// partition by symbol+instrument
	groups := map[string][]Execution{}
	for _, r := range rows {
		key := r.Symbol + "|" + r.InstrumentType
		groups[key] = append(groups[key], Execution{
			ID: r.ID, Symbol: r.Symbol, InstrumentType: r.InstrumentType, Side: r.Side,
			Quantity: r.Quantity, Price: r.Price, Fees: r.Fees, Commission: r.Commission,
			ExecutedAt: r.ExecutedAt, Multiplier: r.Multiplier,
		})
	}
	if err := s.q.DeleteTradesForAccount(ctx, store.DeleteTradesForAccountParams{UserID: userID, AccountID: accountID}); err != nil {
		return err
	}
	for _, g := range groups {
		for _, tr := range Group(g) {
			id := uuid.NewString()
			_, err := s.q.InsertTrade(ctx, toInsertParams(id, userID, accountID, acc.BaseCurrency, tr))
			if err != nil {
				return err
			}
			for _, eid := range tr.ExecutionIDs {
				if err := s.q.LinkTradeExecution(ctx, store.LinkTradeExecutionParams{TradeID: id, ExecutionID: eid}); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// toInsertParams maps the pure engine Trade (which uses *T for nullable fields)
// onto the sqlc-generated InsertTradeParams (which uses sql.Null* for the same
// nullable columns).
func toInsertParams(id, userID, accountID, pnlCurrency string, tr Trade) store.InsertTradeParams {
	return store.InsertTradeParams{
		ID:              id,
		UserID:          userID,
		AccountID:       accountID,
		Symbol:          tr.Symbol,
		InstrumentType:  tr.InstrumentType,
		Direction:       tr.Direction,
		Status:          tr.Status,
		OpenedAt:        tr.OpenedAt,
		ClosedAt:        nt(tr.ClosedAt),
		QtyOpened:       tr.QtyOpened,
		AvgEntryPrice:   tr.AvgEntryPrice,
		AvgExitPrice:    nf(tr.AvgExitPrice),
		GrossPnl:        nf(tr.GrossPnl),
		FeesTotal:       tr.FeesTotal,
		NetPnl:          nf(tr.NetPnl),
		PnlCurrency:     pnlCurrency,
		ReturnPct:       nf(tr.ReturnPct),
		RMultiple:       sql.NullFloat64{}, // not produced by the engine; reserved for manual entry
		TimeInTradeSecs: ni(tr.TimeInTradeSecs),
		Notes:           "",
	}
}

func nf(p *float64) sql.NullFloat64 {
	if p == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *p, Valid: true}
}

func nt(p *time.Time) sql.NullTime {
	if p == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *p, Valid: true}
}

func ni(p *int64) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *p, Valid: true}
}
