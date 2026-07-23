package trades

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/store"
)

type Service struct{ q store.Querier }

func NewService(q store.Querier) *Service { return &Service{q: q} }

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
	// partition by symbol+instrument[+lot|+option contract]
	groups := map[string][]Execution{}
	for _, r := range rows {
		lot := lotKeyFromDetails(r.Details)
		key := partitionKey(r.Symbol, r.InstrumentType, r.Details)
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

// partitionKey isolates overlapping same-symbol positions.
// Prefer explicit lot; OCC-style option symbols are already unique per contract;
// otherwise use right|strike|expiry (inferring call/put from the symbol when missing).
func partitionKey(symbol, instrumentType string, details sql.NullString) string {
	key := symbol + "|" + instrumentType
	if lot := lotKeyFromDetails(details); lot != "" {
		return key + "|" + lot
	}
	// OCC roots already encode expiry/right/strike — don't sub-split on sparse details
	// (one fill with option_right and one without would otherwise leave ghost OPEN trades).
	if instrumentType == "option" && looksLikeOCCOptionSymbol(symbol) {
		return key
	}
	if contract := contractKeyFromDetails(details, symbol, instrumentType); contract != "" {
		return key + "|" + contract
	}
	return key
}

func contractKeyFromDetails(details sql.NullString, symbol, instrumentType string) string {
	var right, strike, expiry string
	if details.Valid && details.String != "" {
		var m map[string]any
		if err := json.Unmarshal([]byte(details.String), &m); err == nil {
			str := func(k string) string {
				switch v := m[k].(type) {
				case string:
					return strings.TrimSpace(v)
				case float64:
					if v == float64(int64(v)) {
						return strconv.FormatInt(int64(v), 10)
					}
					return strconv.FormatFloat(v, 'f', -1, 64)
				default:
					return ""
				}
			}
			right = strings.ToLower(str("option_right"))
			strike = str("strike")
			expiry = str("expiry")
		}
	}
	if instrumentType == "option" && right != "call" && right != "put" {
		right = inferOptionRightFromSymbol(symbol)
	}
	if right == "" && strike == "" && expiry == "" {
		return ""
	}
	return right + "|" + strike + "|" + expiry
}

// looksLikeOCCOptionSymbol detects compact or spaced OCC roots (e.g. TSLA240119C00200000).
func looksLikeOCCOptionSymbol(symbol string) bool {
	return inferOptionRightFromSymbol(symbol) != "" && optionOCCDigitRun(symbol)
}

func optionOCCDigitRun(symbol string) bool {
	compact := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(symbol), " ", ""))
	// Need digits around the C/P marker (expiry yyymmdd + strike).
	for i := 1; i < len(compact)-1; i++ {
		ch := compact[i]
		if (ch == 'C' || ch == 'P') &&
			compact[i-1] >= '0' && compact[i-1] <= '9' &&
			compact[i+1] >= '0' && compact[i+1] <= '9' {
			return true
		}
	}
	return false
}

// inferOptionRightFromSymbol mirrors importer.InferOptionRight for regroup partitioning.
func inferOptionRightFromSymbol(symbol string) string {
	s := strings.TrimSpace(symbol)
	if s == "" {
		return ""
	}
	for _, part := range strings.Fields(s) {
		switch strings.ToLower(strings.TrimSpace(part)) {
		case "call":
			return "call"
		case "put":
			return "put"
		}
	}
	compact := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if right := optionRightFromOCCMarker(compact); right != "" {
		return right
	}
	parts := strings.Fields(s)
	if len(parts) >= 2 {
		return optionRightFromOCCMarker(strings.ToUpper(parts[len(parts)-1]))
	}
	return ""
}

func optionRightFromOCCMarker(s string) string {
	upper := strings.ToUpper(s)
	for i := 1; i < len(upper)-1; i++ {
		ch := upper[i]
		prev, next := upper[i-1], upper[i+1]
		if ch == 'C' && prev >= '0' && prev <= '9' && next >= '0' && next <= '9' {
			return "call"
		}
		if ch == 'P' && prev >= '0' && prev <= '9' && next >= '0' && next <= '9' {
			return "put"
		}
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
