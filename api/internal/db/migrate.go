package db

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"golang.org/x/sys/unix"
)

//go:embed all:migrations
var migrationsFS embed.FS

func Migrate(conn *sql.DB) error {
	dbPath, err := sqliteMainFile(conn)
	if err != nil {
		return err
	}
	return withMigrateLock(dbPath, func() error {
		return migrateUp(conn)
	})
}

func migrateUp(conn *sql.DB) error {
	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return err
	}
	drv, err := sqlite.WithInstance(conn, &sqlite.Config{})
	if err != nil {
		return err
	}

	// air / crash mid-migrate leaves dirty=1 even when DDL mostly applied.
	// Clear it before Up so startup can re-apply idempotent migrations.
	if ver, dirty, vErr := drv.Version(); vErr == nil && dirty {
		prev := ver - 1
		if prev < 0 {
			prev = 0
		}
		if err := drv.SetVersion(prev, false); err != nil {
			return fmt.Errorf("dirty migration at version %d: could not reset: %w", ver, err)
		}
	}

	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		return err
	}
	// Do not m.Close(): WithInstance owns our *sql.DB and Close would shut it down.

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}

func sqliteMainFile(conn *sql.DB) (string, error) {
	var seq int
	var name, file string
	err := conn.QueryRow(`SELECT seq, name, file FROM pragma_database_list WHERE name = 'main'`).Scan(&seq, &name, &file)
	if err != nil {
		return "", err
	}
	return file, nil
}

func withMigrateLock(dbPath string, fn func() error) error {
	if dbPath == "" || dbPath == ":memory:" || strings.HasPrefix(dbPath, "file::memory:") {
		return fn()
	}
	lockPath := dbPath + ".migrate.lock"
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return fmt.Errorf("migrate lock: %w", err)
	}
	defer f.Close()
	if err := unix.Flock(int(f.Fd()), unix.LOCK_EX); err != nil {
		return fmt.Errorf("migrate lock: %w", err)
	}
	defer func() { _ = unix.Flock(int(f.Fd()), unix.LOCK_UN) }()
	return fn()
}
