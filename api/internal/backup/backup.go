// Package backup takes scheduled point-in-time snapshots of the SQLite
// database into a directory on the server and keeps the newest N.
//
// Snapshots are written with `VACUUM INTO` to a hidden temp file, fsynced and
// atomically renamed to tradermemos-YYYYMMDD-HHMMSSZ.db, so a reader of the
// directory (the owner's off-site sync) never sees a half-written file under a
// snapshot name. Status is derived from the directory listing plus the last
// error held in memory — nothing is persisted in the database itself.
//
// Postgres is not handled: the server has no business shelling out to
// pg_dump, so a Postgres deployment reports "unsupported" with a hint.
package backup

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	// DefaultKeep is how many snapshots survive pruning when unset.
	DefaultKeep = 14
	// DefaultInterval is the snapshot cadence when unset.
	DefaultInterval = 24 * time.Hour

	filePrefix = "tradermemos-"
	fileSuffix = "Z.db"
	tempPrefix = ".tmp-" + filePrefix
	// nameLayout is the UTC timestamp between filePrefix and fileSuffix.
	nameLayout = "20060102-150405"
)

// snapshotName matches exactly the files this package writes. Pruning and
// status only ever look at names that match — anything else the owner keeps
// in the directory is left alone.
var snapshotName = regexp.MustCompile(`^tradermemos-\d{8}-\d{6}Z\.db$`)

// Status values reported by Service.Status.
const (
	StateOK          = "ok"          // newest snapshot is fresh, last attempt succeeded
	StateNone        = "none"        // no snapshot yet and no failure recorded
	StateFailed      = "failed"      // the most recent attempt failed
	StateStale       = "stale"       // newest snapshot is older than 2× the interval
	StateDisabled    = "disabled"    // scheduled backups are switched off
	StateUnsupported = "unsupported" // not a SQLite deployment
)

var (
	// ErrRunning is returned when a backup is requested while one is in flight.
	ErrRunning = errors.New("a backup is already running")
	// ErrUnsupported is returned for non-SQLite deployments.
	ErrUnsupported = errors.New("built-in backups support SQLite only")
)

// PostgresHint is shown to Postgres owners instead of a status.
const PostgresHint = "Built-in backups cover SQLite only. Back up Postgres with pg_dump (or your provider's snapshots)."

// Config controls where and how often snapshots are taken.
type Config struct {
	// Driver is the database driver ("sqlite" or "postgres").
	Driver string
	// Dir receives the snapshot files.
	Dir string
	// Keep is how many snapshots survive pruning (minimum 1).
	Keep int
	// Interval is the target age of the newest snapshot.
	Interval time.Duration
	// Scheduled reports whether the background job is registered. Manual
	// "back up now" works either way.
	Scheduled bool
}

// File describes one snapshot on disk.
type File struct {
	Name      string    `json:"name"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}

// Status is the owner-facing summary of the backup directory.
type Status struct {
	Enabled       bool       `json:"enabled"`
	Driver        string     `json:"driver"`
	State         string     `json:"status"`
	Hint          string     `json:"hint,omitempty"`
	Dir           string     `json:"dir,omitempty"`
	Keep          int        `json:"keep"`
	IntervalMin   int        `json:"interval_min"`
	Running       bool       `json:"running"`
	LastSuccessAt *time.Time `json:"last_success_at"`
	LastAttemptAt *time.Time `json:"last_attempt_at"`
	LastError     string     `json:"last_error,omitempty"`
	Latest        *File      `json:"latest"`
	FileCount     int        `json:"file_count"`
}

// Service runs snapshots and reports their state. Safe for concurrent use.
type Service struct {
	db  *sql.DB
	cfg Config
	log *slog.Logger

	// now and afterVacuum are test seams.
	now         func() time.Time
	afterVacuum func(tmpPath string) error

	run     sync.Mutex // held for the duration of a snapshot; TryLock guards overlap
	running atomic.Bool

	mu          sync.Mutex // guards the fields below
	lastAttempt time.Time
	lastErr     string
}

// New builds a Service. conn must be the application's open database.
func New(conn *sql.DB, cfg Config, log *slog.Logger) *Service {
	if cfg.Keep < 1 {
		cfg.Keep = DefaultKeep
	}
	if cfg.Interval <= 0 {
		cfg.Interval = DefaultInterval
	}
	if log == nil {
		log = slog.Default()
	}
	return &Service{db: conn, cfg: cfg, log: log, now: time.Now}
}

// DefaultDir is the snapshot directory used when none is configured: a
// backups/ folder beside the SQLite file.
func DefaultDir(dbPath string) string {
	if dbPath == "" {
		return filepath.Join("data", "backups")
	}
	return filepath.Join(filepath.Dir(dbPath), "backups")
}

// Supported reports whether this deployment can take snapshots.
func (s *Service) Supported() bool { return s.cfg.Driver == "sqlite" }

// Config returns the effective configuration (defaults applied).
func (s *Service) Config() Config { return s.cfg }

// Due reports whether the newest snapshot is old enough that the scheduled
// job should take another. slack absorbs tick jitter so a snapshot taken on
// one tick doesn't miss the tick a full interval later by a few seconds.
func (s *Service) Due(slack time.Duration) (bool, error) {
	files, err := s.list()
	if err != nil {
		return false, err
	}
	if len(files) == 0 {
		return true, nil
	}
	newest := files[len(files)-1].CreatedAt
	return s.now().Sub(newest) >= s.cfg.Interval-slack, nil
}

// Run takes one snapshot now and prunes old ones. It returns ErrRunning if
// another snapshot is in progress and ErrUnsupported on Postgres.
func (s *Service) Run(ctx context.Context) (File, error) {
	if !s.Supported() {
		return File{}, ErrUnsupported
	}
	if !s.run.TryLock() {
		return File{}, ErrRunning
	}
	defer s.run.Unlock()
	s.running.Store(true)
	defer s.running.Store(false)

	started := s.now().UTC()
	f, err := s.snapshot(ctx, started)
	if err == nil {
		if perr := s.prune(); perr != nil {
			err = fmt.Errorf("snapshot %s written, but pruning failed: %w", f.Name, perr)
		}
	}

	s.mu.Lock()
	s.lastAttempt = started
	if err != nil {
		s.lastErr = err.Error()
	} else {
		s.lastErr = ""
	}
	s.mu.Unlock()

	if err != nil {
		s.log.Warn("database backup failed", "dir", s.cfg.Dir, "err", err)
		return f, err
	}
	s.log.Info("database backup written", "file", f.Name, "bytes", f.SizeBytes)
	return f, nil
}

// snapshot writes one VACUUM INTO copy and atomically publishes it. On any
// failure the temp file is removed, so only complete snapshots ever carry a
// snapshot name.
func (s *Service) snapshot(ctx context.Context, at time.Time) (f File, err error) {
	if err := os.MkdirAll(s.cfg.Dir, 0o700); err != nil {
		return File{}, fmt.Errorf("create backup dir: %w", err)
	}
	s.removeStaleTemps()

	name := filePrefix + at.Format(nameLayout) + fileSuffix
	final := filepath.Join(s.cfg.Dir, name)
	suffix, err := randomHex(4)
	if err != nil {
		return File{}, err
	}
	tmp := filepath.Join(s.cfg.Dir, ".tmp-"+name+"-"+suffix)

	defer func() {
		if err != nil {
			removeWithSidecars(tmp)
		}
	}()

	if _, err := s.db.ExecContext(ctx, "VACUUM INTO ?", tmp); err != nil {
		return File{}, fmt.Errorf("vacuum into temp file: %w", err)
	}
	if s.afterVacuum != nil {
		if err := s.afterVacuum(tmp); err != nil {
			return File{}, err
		}
	}
	if err := syncFile(tmp); err != nil {
		return File{}, fmt.Errorf("fsync snapshot: %w", err)
	}
	if err := os.Rename(tmp, final); err != nil {
		return File{}, fmt.Errorf("publish snapshot: %w", err)
	}
	// The rename itself must survive a power cut too.
	if err := syncDir(s.cfg.Dir); err != nil {
		s.log.Warn("fsync backup dir failed", "dir", s.cfg.Dir, "err", err)
	}
	info, err := os.Stat(final)
	if err != nil {
		return File{}, fmt.Errorf("stat snapshot: %w", err)
	}
	return File{Name: name, SizeBytes: info.Size(), CreatedAt: at}, nil
}

// prune deletes the oldest snapshots beyond Keep. Only snapshot-named files
// are considered.
func (s *Service) prune() error {
	files, err := s.list()
	if err != nil {
		return err
	}
	excess := len(files) - s.cfg.Keep
	var errs []error
	for i := 0; i < excess; i++ {
		if err := os.Remove(filepath.Join(s.cfg.Dir, files[i].Name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// removeStaleTemps clears temp files a crashed run (kill -9, power loss) left
// behind. Called with the run lock held, so no live run owns them.
func (s *Service) removeStaleTemps() {
	entries, err := os.ReadDir(s.cfg.Dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), tempPrefix) {
			_ = os.Remove(filepath.Join(s.cfg.Dir, e.Name()))
		}
	}
}

// list returns the snapshots in the directory, oldest first. A missing
// directory is an empty list, not an error.
func (s *Service) list() ([]File, error) {
	entries, err := os.ReadDir(s.cfg.Dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read backup dir: %w", err)
	}
	var out []File
	for _, e := range entries {
		if e.IsDir() || !snapshotName.MatchString(e.Name()) {
			continue
		}
		ts := strings.TrimSuffix(strings.TrimPrefix(e.Name(), filePrefix), fileSuffix)
		at, err := time.ParseInLocation(nameLayout, ts, time.UTC)
		if err != nil {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, File{Name: e.Name(), SizeBytes: info.Size(), CreatedAt: at})
	}
	// The timestamp layout sorts lexically in time order.
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// Status summarizes the directory and the last attempt.
func (s *Service) Status() Status {
	st := Status{
		Enabled:     s.cfg.Scheduled && s.Supported(),
		Driver:      s.cfg.Driver,
		Keep:        s.cfg.Keep,
		IntervalMin: int(s.cfg.Interval / time.Minute),
		Running:     s.running.Load(),
	}
	if !s.Supported() {
		st.State = StateUnsupported
		st.Hint = PostgresHint
		return st
	}
	st.Dir = s.cfg.Dir

	s.mu.Lock()
	lastAttempt, lastErr := s.lastAttempt, s.lastErr
	s.mu.Unlock()

	files, listErr := s.list()
	if listErr != nil && lastErr == "" {
		lastErr = listErr.Error()
	}
	st.FileCount = len(files)
	if len(files) > 0 {
		newest := files[len(files)-1]
		st.Latest = &newest
		at := newest.CreatedAt
		st.LastSuccessAt = &at
	}
	if !lastAttempt.IsZero() {
		st.LastAttemptAt = &lastAttempt
	} else if st.LastSuccessAt != nil {
		// After a restart the in-memory attempt is gone; the newest file is
		// the best evidence of the last attempt we have.
		st.LastAttemptAt = st.LastSuccessAt
	}
	st.LastError = lastErr

	switch {
	case lastErr != "":
		st.State = StateFailed
	case !st.Enabled:
		st.State = StateDisabled
	case st.Latest == nil:
		st.State = StateNone
	case s.now().Sub(st.Latest.CreatedAt) > 2*s.cfg.Interval:
		st.State = StateStale
	default:
		st.State = StateOK
	}
	return st
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func syncFile(path string) error {
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// removeWithSidecars deletes a temp snapshot and any journal SQLite may have
// created next to it.
func removeWithSidecars(path string) {
	for _, p := range []string{path, path + "-journal", path + "-wal", path + "-shm"} {
		_ = os.Remove(p)
	}
}
