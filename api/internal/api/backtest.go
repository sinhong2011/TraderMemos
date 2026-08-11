package api

import (
	"context"

	"github.com/tradermemos/api/internal/store"
)

// AccountTypeBacktest marks paper accounts fed by the bar-replay backtester.
// Their trades and cash stay out of all-account aggregates; passing the
// account's id as the account_id filter opts back in.
const AccountTypeBacktest = "backtest"

// backtestAccountIDs returns the ids of the user's backtest accounts, or nil
// when the filter already targets one specific account (explicit selection
// always wins) or when f opts into backtest rows.
func (s *Server) backtestAccountIDs(ctx context.Context, userID string, f Filters) (map[string]bool, error) {
	if len(f.AccountIDs) > 0 || f.IncludeBacktest {
		return nil, nil
	}
	accs, err := s.deps.Store.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	var out map[string]bool
	for _, a := range accs {
		if a.AccountType == AccountTypeBacktest {
			if out == nil {
				out = make(map[string]bool, 1)
			}
			out[a.ID] = true
		}
	}
	return out, nil
}

// filterCashAccounts drops cash rows belonging to excluded accounts.
func filterCashAccounts(rows []store.CashTransaction, excluded map[string]bool) []store.CashTransaction {
	if len(excluded) == 0 {
		return rows
	}
	out := rows[:0]
	for _, r := range rows {
		if !excluded[r.AccountID] {
			out = append(out, r)
		}
	}
	return out
}
