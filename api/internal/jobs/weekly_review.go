package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/store"
)

// NewWeeklyReview returns a job that sends the Saturday weekly review to every
// user with alerts and the weekly-review toggle on. It runs on a plain
// interval (hourly by default); the service decides whether the review is due
// in each user's market timezone and the weekly_reviews ledger keeps a week
// from firing twice, so running often is cheap and restart-safe.
//
// now is the clock — time.Now in production; TM_WEEKLY_REVIEW_NOW pins it for
// testing. initialDelay of zero means the runner's one-minute default.
func NewWeeklyReview(q store.Querier, svc *alerts.Service, every, initialDelay time.Duration, now func() time.Time, log *slog.Logger) Job {
	run := func(ctx context.Context) error {
		rows, err := q.ListEnabledAlertSettings(ctx)
		if err != nil {
			return err
		}
		at := now()
		for _, r := range rows {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if r.RuleWeeklyReview == 0 {
				continue
			}
			fired, err := svc.WeeklyReview(ctx, r.UserID, at)
			if err != nil {
				log.Warn("weekly review failed", "user", r.UserID, "err", err)
				continue
			}
			if fired {
				log.Info("weekly review sent", "user", r.UserID)
			}
		}
		return nil
	}
	return Job{Name: "weekly_review", Every: every, InitialDelay: initialDelay, Timeout: 5 * time.Minute, Run: run}
}
