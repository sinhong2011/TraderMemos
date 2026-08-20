package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"

	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// NormalizeOCCOptionExecutions rewrites option executions whose symbol is a
// raw OCC string (how broker imports stored them before contract fields moved
// into details) into the canonical shape: symbol = underlying, contract in
// details, dedup hash recomputed so future syncs recognize the fills. Affected
// accounts are regrouped. Runs at startup and is idempotent — a normalized
// symbol no longer parses as OCC.
func NormalizeOCCOptionExecutions(ctx context.Context, q store.Querier, log *slog.Logger) error {
	rows, err := q.ListOptionExecutions(ctx)
	if err != nil {
		return err
	}

	type account struct{ userID, accountID string }
	affected := map[account]bool{}
	updated := 0
	for _, row := range rows {
		c, ok := ParseOCCSymbol(row.Symbol)
		if !ok {
			continue
		}

		details := map[string]string{}
		if row.Details.Valid && row.Details.String != "" {
			_ = json.Unmarshal([]byte(row.Details.String), &details)
			if details == nil {
				details = map[string]string{}
			}
		}
		if details["option_right"] == "" {
			details["option_right"] = c.Right
		}
		details["strike"] = c.Strike
		details["expiry"] = c.Expiry
		detailsJSON, err := json.Marshal(details)
		if err != nil {
			continue
		}

		pe := ParsedExecution{
			Symbol: c.Underlying, InstrumentType: "option",
			OptionRight: details["option_right"], Strike: c.Strike, Expiry: c.Expiry,
		}
		hash := DedupHash(dedupSymbol(pe), row.Side, row.Quantity, row.Price, row.ExecutedAt)
		if err := q.UpdateExecutionContract(ctx, store.UpdateExecutionContractParams{
			Symbol:    c.Underlying,
			Details:   sql.NullString{String: string(detailsJSON), Valid: true},
			DedupHash: hash,
			ID:        row.ID,
			UserID:    row.UserID,
		}); err != nil {
			// A unique-index clash means an identical normalized fill already
			// exists; leave this row for manual cleanup rather than failing boot.
			log.Warn("occ normalize: skipping execution", "id", row.ID, "symbol", row.Symbol, "err", err)
			continue
		}
		updated++
		affected[account{row.UserID, row.AccountID}] = true
	}
	if updated == 0 {
		return nil
	}

	svc := trades.NewService(q)
	for a := range affected {
		if err := svc.Regroup(ctx, a.userID, a.accountID); err != nil {
			log.Warn("occ normalize: regroup failed", "account", a.accountID, "err", err)
		}
	}
	log.Info("occ normalize: rewrote OCC option symbols", "executions", updated, "accounts", len(affected))
	return nil
}
