package trades

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

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
	// partition by symbol+instrument[+lot]
	groups := map[string][]Execution{}
	for _, r := range rows {
		lot := lotKeyFromDetails(r.Details)
		key := r.Symbol + "|" + r.InstrumentType
		if lot != "" {
			key += "|" + lot
		}
		groups[key] = append(groups[key], Execution{
			ID: r.ID, Symbol: r.Symbol, InstrumentType: r.InstrumentType, Side: r.Side,
			Quantity: r.Quantity, Price: r.Price, Fees: r.Fees, Commission: r.Commission,
			ExecutedAt: r.ExecutedAt, Multiplier: r.Multiplier, LotKey: lot,
		})
	}

	keep := []string{}
	for _, g := range groups {
		for _, tr := range Group(g) {
			id := tr.ExecutionIDs[0] // opening fill = stable id
			if err := s.q.UpsertTrade(ctx, toUpsertParams(id, userID, accountID, acc.BaseCurrency, tr)); err != nil {
				return err
			}
			if err := s.q.ClearTradeExecutions(ctx, id); err != nil {
				return err
			}
			for _, eid := range tr.ExecutionIDs {
				if err := s.q.LinkTradeExecution(ctx, store.LinkTradeExecutionParams{TradeID: id, ExecutionID: eid}); err != nil {
					return err
				}
			}
			keep = append(keep, id)
		}
	}

	if len(keep) == 0 {
		return s.q.DeleteTradesForAccount(ctx, store.DeleteTradesForAccountParams{UserID: userID, AccountID: accountID})
	}
	return s.q.DeleteTradesNotInAccount(ctx, store.DeleteTradesNotInAccountParams{UserID: userID, AccountID: accountID, Keep: keep})
}

func lotKeyFromDetails(details sql.NullString) string {
	if !details.Valid || details.String == "" {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(details.String), &m); err != nil {
		return ""
	}
	if v, ok := m["lot"].(string); ok {
		return v
	}
	return ""
}

// toUpsertParams maps the pure engine Trade (which uses *T for nullable fields)
// onto the sqlc-generated UpsertTradeParams (which uses sql.Null* for the same
// nullable columns).
func toUpsertParams(id, userID, accountID, pnlCurrency string, tr Trade) store.UpsertTradeParams {
	return store.UpsertTradeParams{
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
		QtyRemaining:    tr.QtyRemaining,
		AvgEntryPrice:   tr.AvgEntryPrice,
		AvgExitPrice:    nf(tr.AvgExitPrice),
		GrossPnl:        nf(tr.GrossPnl),
		FeesTotal:       tr.FeesTotal,
		NetPnl:          nf(tr.NetPnl),
		PnlCurrency:     pnlCurrency,
		ReturnPct:       nf(tr.ReturnPct),
		RMultiple:       sql.NullFloat64{}, // derived from trade_journal.initial_risk at read time; null in the row
		TimeInTradeSecs: ni(tr.TimeInTradeSecs),
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
