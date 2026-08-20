package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"

	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// NormalizeOptionExecutions brings stored option executions onto the canonical
// shape every write path now produces: symbol = underlying, contract in
// details, and a dedup hash keyed on underlying + contract
// (see OptionDedupSymbol). Two kinds of row need rewriting:
//
//   - broker imports from before the contract moved out of the symbol, whose
//     symbol is still a raw OCC string ("MU 260817C01030000");
//   - options written by manual entry or OCR, which always had the canonical
//     symbol but hashed on the bare symbol alone, so they would not dedup
//     against the same fill arriving from a broker sync.
//
// Affected accounts are regrouped. Runs at startup and is idempotent: a row
// already in canonical form recomputes to the hash it already has and is
// skipped, so a steady-state boot reads the option rows and writes nothing.
//
// There is deliberately no "already migrated" marker: the project has no
// app-level key-value table, and adding one for a single flag costs a schema
// change on both engines plus an sqlc regeneration. A read of the option rows
// with no writes is the same shape as store.SeedInstrumentSpecs, which also
// runs every boot.
func NormalizeOptionExecutions(ctx context.Context, q store.Querier, log *slog.Logger) error {
	rows, err := q.ListOptionExecutions(ctx)
	if err != nil {
		return err
	}

	type account struct{ userID, accountID string }
	affected := map[account]bool{}
	updated := 0
	for _, row := range rows {
		details := map[string]string{}
		if row.Details.Valid && row.Details.String != "" {
			_ = json.Unmarshal([]byte(row.Details.String), &details)
			if details == nil {
				details = map[string]string{}
			}
		}

		symbol := row.Symbol
		detailsCol := row.Details
		// A normalized symbol no longer parses as OCC, so this branch is what
		// makes the symbol rewrite run at most once.
		if c, ok := ParseOCCSymbol(row.Symbol); ok {
			symbol = c.Underlying
			if details["option_right"] == "" {
				details["option_right"] = c.Right
			}
			details["strike"] = c.Strike
			details["expiry"] = c.Expiry
			encoded, merr := json.Marshal(details)
			if merr != nil {
				continue
			}
			detailsCol = sql.NullString{String: string(encoded), Valid: true}
		}

		hash := DedupHash(
			OptionDedupSymbolFromDetails(symbol, "option", details),
			row.Side, row.Quantity, row.Price, row.ExecutedAt,
		)
		if symbol == row.Symbol && hash == row.DedupHash {
			continue
		}

		if err := q.UpdateExecutionContract(ctx, store.UpdateExecutionContractParams{
			Symbol:    symbol,
			Details:   detailsCol,
			DedupHash: hash,
			ID:        row.ID,
			UserID:    row.UserID,
		}); err != nil {
			// A unique-index clash means an identical normalized fill already
			// exists — the cross-path duplicate this migration exists to stop
			// creating. Leave the row for manual cleanup rather than failing boot.
			log.Warn("option normalize: skipping execution", "id", row.ID, "symbol", row.Symbol, "err", err)
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
			log.Warn("option normalize: regroup failed", "account", a.accountID, "err", err)
		}
	}
	log.Info("option normalize: rewrote option contracts and dedup keys",
		"executions", updated, "accounts", len(affected))
	return nil
}
