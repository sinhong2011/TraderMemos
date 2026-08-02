package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/tradermemos/api/internal/flexsync"
	"github.com/tradermemos/api/internal/store"
)

// NewFlexSync returns a job that pulls IBKR Flex statements for every account
// with sync enabled and runs them through the import pipeline. Each account's
// outcome (including failure) is recorded on its settings row, so one broken
// token never blocks other accounts.
func NewFlexSync(q store.Querier, client *flexsync.Client, every time.Duration, log *slog.Logger) Job {
	run := func(ctx context.Context) error {
		rows, err := q.ListEnabledFlexSyncSettings(ctx)
		if err != nil {
			return err
		}
		for _, s := range rows {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			res, err := flexsync.Sync(ctx, q, client, s)
			flexsync.RecordOutcome(ctx, q, s, res, err)
			if err != nil {
				log.Warn("flex sync failed", "account", s.AccountID, "err", err)
				continue
			}
			log.Info("flex sync done", "account", s.AccountID,
				"inserted", res.Inserted, "skipped", res.Skipped, "rows", res.Rows)
		}
		return nil
	}
	// Timeout must cover IBKR's statement generation (up to ~1 min per
	// account under the client's default polling) for several accounts.
	return Job{Name: "ibkr_flex_sync", Every: every, Timeout: 15 * time.Minute, Run: run}
}
