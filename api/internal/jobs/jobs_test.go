package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestRunnerRunsOnSchedule(t *testing.T) {
	var runs atomic.Int32
	r := NewRunner(discardLogger())
	r.Register(Job{
		Name:         "tick",
		Every:        20 * time.Millisecond,
		InitialDelay: time.Millisecond,
		Run: func(ctx context.Context) error {
			runs.Add(1)
			return nil
		},
	})
	r.Start(context.Background())
	defer r.Stop()

	deadline := time.Now().Add(2 * time.Second)
	for runs.Load() < 3 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if got := runs.Load(); got < 3 {
		t.Fatalf("runs = %d, want >= 3", got)
	}
}

func TestRunnerStops(t *testing.T) {
	var runs atomic.Int32
	r := NewRunner(discardLogger())
	r.Register(Job{
		Name:         "tick",
		Every:        10 * time.Millisecond,
		InitialDelay: time.Millisecond,
		Run: func(ctx context.Context) error {
			runs.Add(1)
			return nil
		},
	})
	r.Start(context.Background())

	deadline := time.Now().Add(2 * time.Second)
	for runs.Load() < 1 && time.Now().Before(deadline) {
		time.Sleep(2 * time.Millisecond)
	}
	r.Stop()
	after := runs.Load()
	time.Sleep(50 * time.Millisecond)
	if got := runs.Load(); got != after {
		t.Fatalf("job kept running after Stop: %d -> %d", after, got)
	}
}

func TestRunnerRecoversPanicsAndFailures(t *testing.T) {
	var runs atomic.Int32
	r := NewRunner(discardLogger())
	r.Register(Job{
		Name:         "flaky",
		Every:        10 * time.Millisecond,
		InitialDelay: time.Millisecond,
		Run: func(ctx context.Context) error {
			switch runs.Add(1) {
			case 1:
				panic("boom")
			case 2:
				return errors.New("transient")
			}
			return nil
		},
	})
	r.Start(context.Background())
	defer r.Stop()

	deadline := time.Now().Add(2 * time.Second)
	for runs.Load() < 3 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if got := runs.Load(); got < 3 {
		t.Fatalf("runner did not survive panic/error: runs = %d, want >= 3", got)
	}
}

func TestRunnerAppliesRunTimeout(t *testing.T) {
	timedOut := make(chan struct{}, 1)
	r := NewRunner(discardLogger())
	r.Register(Job{
		Name:         "slow",
		Every:        time.Hour,
		InitialDelay: time.Millisecond,
		Timeout:      15 * time.Millisecond,
		Run: func(ctx context.Context) error {
			<-ctx.Done()
			timedOut <- struct{}{}
			return ctx.Err()
		},
	})
	r.Start(context.Background())
	defer r.Stop()

	select {
	case <-timedOut:
	case <-time.After(2 * time.Second):
		t.Fatal("run context never timed out")
	}
}
