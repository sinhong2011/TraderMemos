package db

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOfficialFeatureVersionMapping(t *testing.T) {
	require.Equal(t, 51, officialSQLiteFeatureVersion(false, false))
	require.Equal(t, 52, officialSQLiteFeatureVersion(true, false))
	require.Equal(t, 53, officialSQLiteFeatureVersion(true, true))
	require.Equal(t, 53, officialSQLiteFeatureVersion(false, true))
	require.Equal(t, 15, officialPostgresFeatureVersion(false, false))
	require.Equal(t, 16, officialPostgresFeatureVersion(true, false))
	require.Equal(t, 17, officialPostgresFeatureVersion(true, true))
}

func TestMigrateCleanOfficialFromEmpty(t *testing.T) {
	conn := openTempDB(t)
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
}

func TestMigrateCleanOfficialFromWeeklyReview(t *testing.T) {
	conn := openTempDB(t)
	migrateSQLiteTo(t, conn, 49)
	require.True(t, sqliteHasTable(t, conn, "weekly_reviews"))
	require.False(t, sqliteHasTable(t, conn, "mcp_settings"))
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
}

func TestMigrateCleanOfficialFromMCPSettings(t *testing.T) {
	conn := openTempDB(t)
	migrateSQLiteTo(t, conn, 50)
	require.True(t, sqliteHasTable(t, conn, "mcp_settings"))
	require.False(t, sqliteHasTable(t, conn, "trading_systems"))
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
}

func TestMigrateCustomSQLite52Clean(t *testing.T) {
	conn := openTempDB(t)
	seedCustomTradingSystemHistory(t, conn, customHistory{
		version: 52, dirty: false, plans: true, evidence: true,
	})
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, true, true)
	// Second boot must be a no-op for existing rows.
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, true, true)
}

func TestMigrateCustomSQLite51Clean(t *testing.T) {
	conn := openTempDB(t)
	seedCustomTradingSystemHistory(t, conn, customHistory{
		version: 51, dirty: false, plans: true, evidence: false,
	})
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, true, false)
	require.True(t, sqliteHasTable(t, conn, "system_plan_evidence"))
}

func TestMigrateCustomSQLite50Clean(t *testing.T) {
	conn := openTempDB(t)
	seedCustomTradingSystemHistory(t, conn, customHistory{
		version: 50, dirty: false, plans: false, evidence: false,
	})
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, false, false)
	require.True(t, sqliteHasTable(t, conn, "system_plans"))
	require.True(t, sqliteHasTable(t, conn, "system_plan_evidence"))
}

func TestMigrateCustomSQLite52Dirty(t *testing.T) {
	conn := openTempDB(t)
	seedCustomTradingSystemHistory(t, conn, customHistory{
		version: 52, dirty: true, plans: true, evidence: true,
	})
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, true, true)
}

func TestMigrateCustomSQLite52DirtyBeforeEvidenceTable(t *testing.T) {
	conn := openTempDB(t)
	seedCustomTradingSystemHistory(t, conn, customHistory{
		version: 52, dirty: true, plans: true, evidence: false,
	})
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
	assertCustomFeatureData(t, conn, true, false)
	require.True(t, sqliteHasTable(t, conn, "system_plan_evidence"))
}

func TestMigrateAmbiguousVersion52NoTables(t *testing.T) {
	conn := openTempDB(t)
	migrateSQLiteTo(t, conn, 49)
	setSchemaVersion(t, conn, 52, false)
	err := Migrate(conn)
	require.Error(t, err)
	require.Contains(t, err.Error(), "refusing to rewrite the version")
	ver, dirty := schemaMigrationState(t, conn)
	require.Equal(t, 52, ver)
	require.False(t, dirty)
	require.False(t, sqliteHasTable(t, conn, "mcp_settings"))
	require.False(t, sqliteHasTable(t, conn, "trading_systems"))
	require.True(t, sqliteHasTable(t, conn, "weekly_reviews"))
}

func TestMigrateAmbiguousVersion52MCPWithoutTradingSystem(t *testing.T) {
	conn := openTempDB(t)
	migrateSQLiteTo(t, conn, 50)
	setSchemaVersion(t, conn, 52, false)
	err := Migrate(conn)
	require.Error(t, err)
	require.Contains(t, err.Error(), "refusing to rewrite the version")
	ver, dirty := schemaMigrationState(t, conn)
	require.Equal(t, 52, ver)
	require.False(t, dirty)
	require.True(t, sqliteHasTable(t, conn, "mcp_settings"))
	require.False(t, sqliteHasTable(t, conn, "trading_systems"))
}

func TestMigrateRepairOfficial50MissingMCPSettings(t *testing.T) {
	conn := openTempDB(t)
	migrateSQLiteTo(t, conn, 50)
	mustExec(t, conn, `DROP TABLE mcp_settings`)
	require.False(t, sqliteHasTable(t, conn, "mcp_settings"))
	require.NoError(t, Migrate(conn))
	assertOfficialHead(t, conn)
}

type customHistory struct {
	version  int
	dirty    bool
	plans    bool
	evidence bool
}

func seedCustomTradingSystemHistory(t *testing.T, conn *sql.DB, hist customHistory) {
	t.Helper()
	migrateSQLiteTo(t, conn, 49)
	require.True(t, sqliteHasTable(t, conn, "weekly_reviews"))
	require.False(t, sqliteHasTable(t, conn, "mcp_settings"))

	mustExec(t, conn, `INSERT INTO users (id, email, password_hash) VALUES ('legacy-user', 'legacy@example.test', 'x')`)
	mustExec(t, conn, `INSERT INTO journal_notes (id, user_id, occurred_at, title, body, symbols, note_type)
		VALUES ('legacy-note', 'legacy-user', '2026-10-01', 'Week notes', 'keep me', '[]', 'weekly_review')`)
	mustExec(t, conn, `INSERT INTO weekly_reviews (user_id, week_start, note_id) VALUES ('legacy-user', '2026-09-28', 'legacy-note')`)

	require.NoError(t, applyEmbeddedSQL(conn, migrationsFS, "migrations/000051_trading_system.up.sql"))
	mustExec(t, conn, `INSERT INTO trading_systems (id, user_id, name) VALUES ('legacy-system', 'legacy-user', 'Keep this system')`)
	mustExec(t, conn, `INSERT INTO system_versions (id, system_id, user_id, label, status, name)
		VALUES ('legacy-version', 'legacy-system', 'legacy-user', 'v1.0', 'active', 'Draft rules')`)

	if hist.plans || hist.evidence {
		require.NoError(t, applyEmbeddedSQL(conn, migrationsFS, "migrations/000052_system_plans.up.sql"))
		mustExec(t, conn, `INSERT INTO system_plans (id, user_id, version_id, symbol, direction, status, source)
			VALUES ('legacy-plan', 'legacy-user', 'legacy-version', 'AAPL', 'long', 'planned', 'live')`)
	}
	if hist.evidence {
		require.NoError(t, applyEmbeddedSQL(conn, migrationsFS, "migrations/000053_system_plan_evidence.up.sql"))
		mustExec(t, conn, `INSERT INTO system_plan_evidence (id, plan_id, user_id)
			VALUES ('legacy-evidence', 'legacy-plan', 'legacy-user')`)
	}

	setSchemaVersion(t, conn, hist.version, hist.dirty)
	require.False(t, sqliteHasTable(t, conn, "mcp_settings"))
}

func assertCustomFeatureData(t *testing.T, conn *sql.DB, wantPlan, wantEvidence bool) {
	t.Helper()
	var name string
	require.NoError(t, conn.QueryRow(`SELECT name FROM trading_systems WHERE id = 'legacy-system'`).Scan(&name))
	require.Equal(t, "Keep this system", name)
	var note string
	require.NoError(t, conn.QueryRow(`SELECT body FROM journal_notes WHERE id = 'legacy-note'`).Scan(&note))
	require.Equal(t, "keep me", note)
	var reviews int
	require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM weekly_reviews WHERE user_id = 'legacy-user'`).Scan(&reviews))
	require.Equal(t, 1, reviews)
	if wantPlan {
		var symbol string
		require.NoError(t, conn.QueryRow(`SELECT symbol FROM system_plans WHERE id = 'legacy-plan'`).Scan(&symbol))
		require.Equal(t, "AAPL", symbol)
	}
	if wantEvidence {
		var n int
		require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM system_plan_evidence WHERE id = 'legacy-evidence'`).Scan(&n))
		require.Equal(t, 1, n)
	}
	var mcp int
	require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM mcp_settings`).Scan(&mcp))
	require.Equal(t, 0, mcp, "upgrade must not opt existing users into MCP")
}

func assertOfficialHead(t *testing.T, conn *sql.DB) {
	t.Helper()
	ver, dirty := schemaMigrationState(t, conn)
	require.Equal(t, sqliteOfficialCurrent, ver)
	require.False(t, dirty)
	for _, table := range []string{
		"weekly_reviews",
		"mcp_settings",
		"trading_systems",
		"system_plans",
		"system_plan_evidence",
	} {
		require.True(t, sqliteHasTable(t, conn, table), table)
	}
}

func openTempDB(t *testing.T) *sql.DB {
	t.Helper()
	conn, err := Open(filepath.Join(t.TempDir(), "test.db"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func mustExec(t *testing.T, conn *sql.DB, q string, args ...any) {
	t.Helper()
	_, err := conn.Exec(q, args...)
	require.NoError(t, err)
}

func setSchemaVersion(t *testing.T, conn *sql.DB, version int, dirty bool) {
	t.Helper()
	d := 0
	if dirty {
		d = 1
	}
	mustExec(t, conn, `UPDATE schema_migrations SET version = ?, dirty = ?`, version, d)
	got, gotDirty := schemaMigrationState(t, conn)
	require.Equal(t, version, got)
	require.Equal(t, dirty, gotDirty)
}

func schemaMigrationState(t *testing.T, conn *sql.DB) (int, bool) {
	t.Helper()
	var ver int
	var dirty bool
	require.NoError(t, conn.QueryRow(`SELECT version, dirty FROM schema_migrations`).Scan(&ver, &dirty))
	return ver, dirty
}

func sqliteHasTable(t *testing.T, conn *sql.DB, name string) bool {
	t.Helper()
	ok, err := sqliteTableExists(conn, name)
	require.NoError(t, err)
	return ok
}
