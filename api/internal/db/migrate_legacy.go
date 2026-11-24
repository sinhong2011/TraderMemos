package db

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
)

// Official published numbering after 0.16.1:
//
//	SQLite   50 mcp_settings, 51 trading_system, 52 system_plans, 53 system_plan_evidence
//	Postgres 14 mcp_settings, 15 trading_system, 16 system_plans, 17 system_plan_evidence
//
// A draft trading-system build applied those feature tables as SQLite 50–52
// (Postgres 14–16) before mcp_settings took those numbers. A self-host at
// custom version 52 therefore has the feature schema and is missing
// mcp_settings; official 0.16.1 then failed to start with
// "no migration found for version 52".
//
// reconcile* detects that history, applies mcp_settings, records the
// matching official version from the tables that already exist, and leaves
// remaining migrations to Up(). Unexpected schemas return an error instead
// of rewriting schema_migrations.

const (
	sqliteMCPMigration    = 50
	sqliteCustomMax       = 52
	sqliteOfficialCurrent = 53
	pgMCPMigration        = 14
	pgCustomMax           = 16
	pgOfficialCurrent     = 17
)

func reconcileSQLiteMigrations(conn *sql.DB, drv database.Driver) error {
	return reconcileLegacyFeatureMigrations(legacyReconcile{
		conn:            conn,
		drv:             drv,
		hasTable:        sqliteTableExists,
		sqlFS:           migrationsFS,
		mcpSQL:          "migrations/000050_mcp_settings.up.sql",
		mcpVersion:      sqliteMCPMigration,
		customMax:       sqliteCustomMax,
		officialVersion: officialSQLiteFeatureVersion,
	})
}

func reconcilePostgresMigrations(conn *sql.DB, drv database.Driver) error {
	return reconcileLegacyFeatureMigrations(legacyReconcile{
		conn:            conn,
		drv:             drv,
		hasTable:        postgresTableExists,
		sqlFS:           migrationsPGFS,
		mcpSQL:          "migrations_pg/000014_mcp_settings.up.sql",
		mcpVersion:      pgMCPMigration,
		customMax:       pgCustomMax,
		officialVersion: officialPostgresFeatureVersion,
	})
}

type legacyReconcile struct {
	conn            *sql.DB
	drv             database.Driver
	hasTable        func(*sql.DB, string) (bool, error)
	sqlFS           embed.FS
	mcpSQL          string
	mcpVersion      int
	customMax       int
	officialVersion func(hasPlans, hasEvidence bool) int
}

func reconcileLegacyFeatureMigrations(cfg legacyReconcile) error {
	ver, dirty, hasVersion, err := schemaVersion(cfg.drv)
	if err != nil {
		return err
	}
	hasMCP, err := cfg.hasTable(cfg.conn, "mcp_settings")
	if err != nil {
		return err
	}
	hasTS, err := cfg.hasTable(cfg.conn, "trading_systems")
	if err != nil {
		return err
	}
	hasPlans, err := cfg.hasTable(cfg.conn, "system_plans")
	if err != nil {
		return err
	}
	hasEvidence, err := cfg.hasTable(cfg.conn, "system_plan_evidence")
	if err != nil {
		return err
	}

	// Custom draft history: feature tables already exist, mcp_settings does
	// not, and schema_migrations still uses the pre-0.16.1 feature numbers.
	if hasTS && !hasMCP && hasVersion && ver >= cfg.mcpVersion && ver <= cfg.customMax {
		if err := applyEmbeddedSQL(cfg.conn, cfg.sqlFS, cfg.mcpSQL); err != nil {
			return fmt.Errorf("migrate: apply mcp_settings for custom trading-system schema at version %d: %w", ver, err)
		}
		target := cfg.officialVersion(hasPlans, hasEvidence)
		if err := cfg.drv.SetVersion(target, false); err != nil {
			return fmt.Errorf("migrate: record official version %d after custom trading-system schema at version %d: %w", target, ver, err)
		}
		return nil
	}

	if hasVersion && ver > cfg.mcpVersion && !hasTS && !hasMCP {
		return ambiguousMigrationError(ver)
	}
	if hasVersion && ver > cfg.mcpVersion && !hasTS && hasMCP {
		// Official 0.16.1 is mcp_settings only (version mcpVersion). A later
		// version without trading_systems is not a known history — Up() would
		// skip the missing feature migrations.
		return ambiguousMigrationError(ver)
	}

	// Official 50/14 recorded without mcp_settings (interrupted but marked clean).
	if hasVersion && ver == cfg.mcpVersion && !hasMCP && !hasTS {
		if err := applyEmbeddedSQL(cfg.conn, cfg.sqlFS, cfg.mcpSQL); err != nil {
			return fmt.Errorf("migrate: repair missing mcp_settings at version %d: %w", ver, err)
		}
	}

	// Feature tables already on official numbers, but mcp_settings is missing.
	if hasTS && !hasMCP && hasVersion && ver > cfg.customMax {
		if err := applyEmbeddedSQL(cfg.conn, cfg.sqlFS, cfg.mcpSQL); err != nil {
			return fmt.Errorf("migrate: apply missing mcp_settings at version %d: %w", ver, err)
		}
	}

	// air / crash mid-migrate leaves dirty=1 even when DDL mostly applied.
	// Clear it before Up so startup can re-apply idempotent migrations.
	// This rewinds one version, so every up migration must be safe to re-run
	// against a database that already has it (CREATE TABLE/INDEX IF NOT EXISTS).
	if hasVersion && dirty {
		prev := max(ver-1, 0)
		if err := cfg.drv.SetVersion(prev, false); err != nil {
			return fmt.Errorf("dirty migration at version %d: could not reset: %w", ver, err)
		}
	}
	return nil
}

func officialSQLiteFeatureVersion(hasPlans, hasEvidence bool) int {
	if hasEvidence {
		return 53
	}
	if hasPlans {
		return 52
	}
	return 51
}

func officialPostgresFeatureVersion(hasPlans, hasEvidence bool) int {
	if hasEvidence {
		return 17
	}
	if hasPlans {
		return 16
	}
	return 15
}

func ambiguousMigrationError(ver int) error {
	return fmt.Errorf("migrate: schema_migrations version %d does not match a known official or custom trading-system history; refusing to rewrite the version or apply later migrations", ver)
}

func schemaVersion(drv database.Driver) (ver int, dirty bool, hasVersion bool, err error) {
	ver, dirty, vErr := drv.Version()
	if vErr != nil {
		if errors.Is(vErr, migrate.ErrNilVersion) {
			return 0, false, false, nil
		}
		return 0, false, false, vErr
	}
	if ver == database.NilVersion {
		return 0, dirty, false, nil
	}
	return ver, dirty, true, nil
}

func sqliteTableExists(conn *sql.DB, name string) (bool, error) {
	var n int
	err := conn.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, name).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("migrate: check table %s: %w", name, err)
	}
	return n > 0, nil
}

func postgresTableExists(conn *sql.DB, name string) (bool, error) {
	var n int
	err := conn.QueryRow(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, name).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("migrate: check table %s: %w", name, err)
	}
	return n > 0, nil
}

func applyEmbeddedSQL(conn *sql.DB, fs embed.FS, path string) error {
	body, err := fs.ReadFile(path)
	if err != nil {
		return err
	}
	if _, err := conn.Exec(string(body)); err != nil {
		return err
	}
	return nil
}
