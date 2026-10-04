package jobs

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/tradermemos/api/internal/backup"
)

// maxBackupTick bounds how often the backup job wakes to check freshness.
// The job ticks more often than the snapshot interval so a restart (which
// resets the runner's timers) delays the next snapshot by at most one tick
// instead of a whole interval.
const maxBackupTick = time.Hour

// NewBackup returns a job that snapshots the SQLite database whenever the
// newest snapshot is at least one interval old. It first runs shortly after
// boot, so a server restarted mid-interval catches up instead of skipping a day.
func NewBackup(svc *backup.Service, log *slog.Logger) Job {
	interval := svc.Config().Interval
	tick := min(interval, maxBackupTick)
	slack := tick / 2
	run := func(ctx context.Context) error {
		due, err := svc.Due(slack)
		if err != nil {
			// An unreadable directory is the same failure a snapshot would hit;
			// run it anyway so the error lands in the reported status.
			log.Warn("backup freshness check failed", "err", err)
			due = true
		}
		if !due {
			return nil
		}
		_, err = svc.Run(ctx)
		if errors.Is(err, backup.ErrRunning) {
			// A manual "back up now" is mid-flight; it covers this tick.
			return nil
		}
		return err
	}
	return Job{
		Name:         "database_backup",
		Every:        tick,
		InitialDelay: 30 * time.Second,
		Timeout:      30 * time.Minute,
		Run:          run,
	}
}
