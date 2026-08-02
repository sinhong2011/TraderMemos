package jobs

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"time"

	"github.com/tradermemos/api/internal/excursion"
	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/store"
)

// Post-exit backfill bounds: wait an hour after the close so the window has
// plausibly traded, and give up on trades older than 60 days (their fine bars
// are gone anyway) so the queue converges.
const (
	postExitMinAge = time.Hour
	postExitMaxAge = 60 * 24 * time.Hour
)

// NewExcursionBackfill returns a job that fills in missing MAE/MFE for closed
// trades, newest first, so excursion-driven reports (R analysis, loss-aversion
// give-backs) stop depending on the per-trade auto-compute button.
//
// Each run attempts at most limit trades — every attempt may hit the market
// data provider, so the cap bounds API spend per tick, with pause between
// attempts. Trades that turn out to be uncomputable (unsupported symbol,
// expired intraday bars, no bar coverage) are remembered in memory and not
// retried until the process restarts; a provider fetch failure aborts the run
// and leaves the batch for the next tick.
func NewExcursionBackfill(
	q store.Querier,
	market *marketdata.Service,
	every time.Duration,
	limit int,
	pause time.Duration,
	log *slog.Logger,
) Job {
	skip := make(map[string]struct{})
	run := func(ctx context.Context) error {
		now := time.Now().UTC()
		rows, err := q.ListTradesMissingExcursion(ctx, store.ListTradesMissingExcursionParams{
			PostCutoff: sql.NullTime{Time: now.Add(-postExitMinAge), Valid: true},
			PostFloor:  sql.NullTime{Time: now.Add(-postExitMaxAge), Valid: true},
			RowLimit:   int64(limit + len(skip)),
		})
		if err != nil {
			return err
		}
		attempts, filled := 0, 0
		for _, t := range rows {
			if attempts >= limit {
				break
			}
			if _, skipped := skip[t.ID]; skipped {
				continue
			}
			if attempts > 0 && pause > 0 {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(pause):
				}
			}
			attempts++
			res, err := excursion.AutoCompute(ctx, q, market, t)
			switch {
			case err == nil:
				filled++
				log.Info("excursion backfilled",
					"trade", t.ID, "symbol", t.Symbol, "mae", res.Mae, "mfe", res.Mfe, "interval", res.Interval)
			case ctx.Err() != nil:
				return ctx.Err()
			case errors.Is(err, excursion.ErrBarsFetch):
				// Provider trouble affects the whole batch — stop and let the
				// next tick retry from the top.
				return err
			default:
				// Uncomputable for this trade specifically — don't burn an
				// attempt on it every tick.
				skip[t.ID] = struct{}{}
				log.Debug("excursion backfill skipped", "trade", t.ID, "symbol", t.Symbol, "reason", err)
			}
		}
		if filled > 0 || attempts > 0 {
			log.Info("excursion backfill pass", "attempted", attempts, "filled", filled, "skipped_total", len(skip))
		}
		return nil
	}
	return Job{Name: "excursion_backfill", Every: every, Run: run}
}
