package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/store"
)

// NewAlertScan returns a job that re-evaluates journal alerts for every user
// with alerts enabled. The write-path hook covers trade-driven rules promptly;
// this scan catches time-driven ones (unreviewed trades aging past the
// threshold) and anything a missed hook left behind. Per-user failures are
// logged so one broken user never blocks the rest.
func NewAlertScan(q store.Querier, svc *alerts.Service, every time.Duration, log *slog.Logger) Job {
	run := func(ctx context.Context) error {
		rows, err := q.ListEnabledAlertSettings(ctx)
		if err != nil {
			return err
		}
		for _, r := range rows {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if err := svc.EvaluateUser(ctx, r.UserID); err != nil {
				log.Warn("alert scan failed", "user", r.UserID, "err", err)
			}
		}
		return nil
	}
	return Job{Name: "journal_alerts", Every: every, Timeout: 5 * time.Minute, Run: run}
}
