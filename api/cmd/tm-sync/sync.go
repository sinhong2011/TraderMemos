package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/tradermemos/api/internal/importer"
)

// maxStatementBytes caps how much of a candidate file is read; real
// MetaTrader reports are well under this.
const maxStatementBytes = 32 << 20

// debounceDelay lets the terminal finish writing a report before parsing —
// MT terminals write statements progressively.
const debounceDelay = 2 * time.Second

// rescanInterval is the periodic full-scan fallback for events fsnotify
// misses (network shares, editors that replace files atomically).
const rescanInterval = 15 * time.Minute

// Syncer watches statement directories and replays their fills to the server.
type Syncer struct {
	cfg    Config
	client *Client
	log    *slog.Logger

	mu   sync.Mutex
	seen map[string]fileStamp
}

// fileStamp marks a successfully synced file version; a changed mtime or size
// re-syncs it (the server dedups replayed fills).
type fileStamp struct {
	modTime time.Time
	size    int64
}

func newSyncer(cfg Config, client *Client, log *slog.Logger) *Syncer {
	return &Syncer{cfg: cfg, client: client, log: log, seen: map[string]fileStamp{}}
}

func statementCandidate(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".html", ".htm", ".xlsx":
		return true
	}
	return false
}

// ScanOnce processes every candidate file in every watched directory.
func (s *Syncer) ScanOnce(ctx context.Context) error {
	var firstErr error
	for _, rule := range s.cfg.Watch {
		entries, err := os.ReadDir(rule.Dir)
		if err != nil {
			s.log.Error("cannot read watch dir", "dir", rule.Dir, "err", err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !statementCandidate(e.Name()) {
				continue
			}
			if err := s.processFile(ctx, filepath.Join(rule.Dir, e.Name()), rule); err != nil && firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

// processFile syncs one file if it looks like a MetaTrader statement and this
// version hasn't been synced yet. Returns an error only for server/IO
// failures — non-statement files are skipped silently.
func (s *Syncer) processFile(ctx context.Context, path string, rule WatchRule) error {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil // vanished between event and read — the next event retries
	}
	if info.Size() > maxStatementBytes {
		s.log.Warn("skipping oversized file", "file", path, "bytes", info.Size())
		return nil
	}
	stamp := fileStamp{modTime: info.ModTime(), size: info.Size()}
	s.mu.Lock()
	done := s.seen[path] == stamp
	s.mu.Unlock()
	if done {
		return nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		s.log.Error("cannot read file", "file", path, "err", err)
		return err
	}
	st, ok := importer.DetectMTStatement(data)
	if !ok {
		return nil
	}
	res := st.Parse(rule.SourceTZ)
	for _, rowErr := range res.Errors {
		s.log.Warn("statement row skipped", "file", filepath.Base(path), "row", rowErr.Row, "reason", rowErr.Message)
	}

	inserted, deduped := 0, 0
	for _, ex := range res.Executions {
		outcome, err := s.client.PostExecution(ctx, s.cfg.AccountID, ex)
		if err != nil {
			// Leave the file unstamped so the next event or rescan retries;
			// fills already posted are safe to replay (server dedup).
			s.log.Error("sync failed", "file", filepath.Base(path), "symbol", ex.Symbol, "err", err)
			return err
		}
		if outcome == postDeduped {
			deduped++
		} else {
			inserted++
		}
	}
	s.mu.Lock()
	s.seen[path] = stamp
	s.mu.Unlock()
	s.log.Info("statement synced",
		"file", filepath.Base(path), "platform", st.Platform,
		"inserted", inserted, "already_synced", deduped, "row_errors", len(res.Errors))
	return nil
}

// Watch runs until ctx is cancelled: an initial scan, fsnotify events with
// debounce, and a periodic rescan fallback.
func (s *Syncer) Watch(ctx context.Context) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	ruleByDir := map[string]WatchRule{}
	for _, rule := range s.cfg.Watch {
		if err := watcher.Add(rule.Dir); err != nil {
			return fmt.Errorf("watch %s: %w", rule.Dir, err)
		}
		ruleByDir[filepath.Clean(rule.Dir)] = rule
		s.log.Info("watching", "dir", rule.Dir, "source_tz", cmpOr(rule.SourceTZ, importer.MTServerTZ))
	}

	if err := s.ScanOnce(ctx); err != nil {
		s.log.Warn("initial scan incomplete — will retry on events and rescans", "err", err)
	}

	var mu sync.Mutex
	timers := map[string]*time.Timer{}
	schedule := func(path string, rule WatchRule) {
		mu.Lock()
		defer mu.Unlock()
		if t, ok := timers[path]; ok {
			t.Stop()
		}
		timers[path] = time.AfterFunc(debounceDelay, func() {
			mu.Lock()
			delete(timers, path)
			mu.Unlock()
			_ = s.processFile(ctx, path, rule)
		})
	}

	rescan := time.NewTicker(rescanInterval)
	defer rescan.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-rescan.C:
			_ = s.ScanOnce(ctx)
		case ev, ok := <-watcher.Events:
			if !ok {
				return nil
			}
			if !ev.Op.Has(fsnotify.Create) && !ev.Op.Has(fsnotify.Write) && !ev.Op.Has(fsnotify.Rename) {
				continue
			}
			if !statementCandidate(ev.Name) {
				continue
			}
			if rule, ok := ruleByDir[filepath.Clean(filepath.Dir(ev.Name))]; ok {
				schedule(ev.Name, rule)
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return nil
			}
			s.log.Error("watcher error", "err", err)
		}
	}
}

func cmpOr(v, fallback string) string {
	if v != "" {
		return v
	}
	return fallback
}
