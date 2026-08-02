// Package jobs is a minimal in-process background scheduler: registered jobs
// run on fixed intervals in their own goroutines, with panic recovery and
// per-run timeouts. It is deliberately not a queue — no persistence, no
// retries beyond the next tick, no cross-instance coordination. Instances
// that must not run jobs (extra replicas) disable them with TM_JOBS_ENABLED.
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Job is one recurring unit of background work.
type Job struct {
	Name string
	// Every is the interval between run starts; required.
	Every time.Duration
	// InitialDelay defers the first run after Start. Zero means one minute —
	// boot should settle before background work competes for the DB.
	InitialDelay time.Duration
	// Timeout caps a single run. Zero means Every (a run never overlaps the
	// next tick of the same job).
	Timeout time.Duration
	Run     func(ctx context.Context) error
}

// Runner owns the goroutines for a set of registered jobs.
type Runner struct {
	log    *slog.Logger
	jobs   []Job
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func NewRunner(log *slog.Logger) *Runner {
	return &Runner{log: log}
}

// Register adds a job. Must be called before Start.
func (r *Runner) Register(j Job) {
	r.jobs = append(r.jobs, j)
}

// Names lists registered job names, for boot logging.
func (r *Runner) Names() []string {
	names := make([]string, 0, len(r.jobs))
	for _, j := range r.jobs {
		names = append(names, j.Name)
	}
	return names
}

// Start launches one goroutine per registered job. The jobs stop when ctx is
// cancelled or Stop is called.
func (r *Runner) Start(ctx context.Context) {
	ctx, r.cancel = context.WithCancel(ctx)
	for _, j := range r.jobs {
		r.wg.Add(1)
		go func(j Job) {
			defer r.wg.Done()
			r.loop(ctx, j)
		}(j)
	}
}

// Stop cancels all jobs and waits for in-flight runs to return.
func (r *Runner) Stop() {
	if r.cancel != nil {
		r.cancel()
	}
	r.wg.Wait()
}

func (r *Runner) loop(ctx context.Context, j Job) {
	delay := j.InitialDelay
	if delay == 0 {
		delay = time.Minute
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			r.runOne(ctx, j)
			timer.Reset(j.Every)
		}
	}
}

// runOne executes a single run with panic recovery and the per-run timeout.
func (r *Runner) runOne(ctx context.Context, j Job) {
	timeout := j.Timeout
	if timeout == 0 {
		timeout = j.Every
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()
	err := func() (err error) {
		defer func() {
			if p := recover(); p != nil {
				err = fmt.Errorf("panic: %v", p)
			}
		}()
		return j.Run(runCtx)
	}()

	if err != nil {
		r.log.Warn("job failed", "job", j.Name, "took", time.Since(start).Round(time.Millisecond), "err", err)
		return
	}
	r.log.Info("job finished", "job", j.Name, "took", time.Since(start).Round(time.Millisecond))
}
