package db

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/stretchr/testify/require"
)

// migrateSQLiteTo stops the SQLite chain at version — the state of a database
// that predates the migrations after it.
func migrateSQLiteTo(t *testing.T, conn *sql.DB, version uint) {
	t.Helper()
	src, err := iofs.New(migrationsFS, "migrations")
	require.NoError(t, err)
	drv, err := sqlite.WithInstance(conn, &sqlite.Config{})
	require.NoError(t, err)
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	require.NoError(t, err)
	require.NoError(t, m.Migrate(version))
}

// 000049 rebuilds alert_settings to add rule_weekly_review. On a database
// that already holds notes and alert settings it must keep every row, turn
// the weekly review on for existing alert users, and survive a dirty re-run.
func TestWeeklyReviewMigrationOnExistingData(t *testing.T) {
	conn, err := Open(filepath.Join(t.TempDir(), "existing.db"))
	require.NoError(t, err)
	defer conn.Close()

	migrateSQLiteTo(t, conn, 48)

	mustExec := func(q string, args ...any) {
		t.Helper()
		_, err := conn.Exec(q, args...)
		require.NoError(t, err)
	}
	mustExec(`INSERT INTO users (id, email, password_hash) VALUES ('u1', 'u1@x.com', 'x')`)
	mustExec(`INSERT INTO journal_notes (id, user_id, occurred_at, title, body, symbols, note_type)
	          VALUES ('n1', 'u1', '2026-09-30', 'Plan', 'body one', '[]', 'note'),
	                 ('n2', 'u1', '2026-10-01', 'Daily log', '- [x] prep', '[{"symbol":"AAPL","body":"x"}]', 'daily_log')`)
	mustExec(`INSERT INTO alert_settings (user_id, enabled, timezone, rule_risk, loss_streak_n, prop_warn_pct, unreviewed_days)
	          VALUES ('u1', 1, 'Asia/Hong_Kong', 0, 4, 0.7, 10)`)

	require.NoError(t, Migrate(conn))

	var ver int
	var dirty bool
	require.NoError(t, conn.QueryRow(`SELECT version, dirty FROM schema_migrations`).Scan(&ver, &dirty))
	require.GreaterOrEqual(t, ver, 49)
	require.False(t, dirty)

	assertRows := func() {
		t.Helper()
		var notes int
		require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM journal_notes WHERE user_id = 'u1'`).Scan(&notes))
		require.Equal(t, 2, notes)
		var body, symbols, noteType string
		require.NoError(t, conn.QueryRow(`SELECT body, symbols, note_type FROM journal_notes WHERE id = 'n2'`).Scan(&body, &symbols, &noteType))
		require.Equal(t, "- [x] prep", body)
		require.Equal(t, `[{"symbol":"AAPL","body":"x"}]`, symbols)
		require.Equal(t, "daily_log", noteType)

		var enabled, ruleRisk, streakN, unreviewedDays, weekly int
		var tz string
		var warn float64
		require.NoError(t, conn.QueryRow(`SELECT enabled, timezone, rule_risk, loss_streak_n, prop_warn_pct, unreviewed_days, rule_weekly_review
		                                   FROM alert_settings WHERE user_id = 'u1'`).
			Scan(&enabled, &tz, &ruleRisk, &streakN, &warn, &unreviewedDays, &weekly))
		require.Equal(t, 1, enabled)
		require.Equal(t, "Asia/Hong_Kong", tz)
		require.Equal(t, 0, ruleRisk)
		require.Equal(t, 4, streakN)
		require.InDelta(t, 0.7, warn, 1e-9)
		require.Equal(t, 10, unreviewedDays)
		require.Equal(t, 1, weekly, "weekly review defaults on for existing alert users")
	}
	assertRows()

	// The notes table still takes the new type (no CHECK constraint to widen).
	mustExec(`INSERT INTO journal_notes (id, user_id, occurred_at, title, body, symbols, note_type)
	          VALUES ('n3', 'u1', '2026-10-03', 'Week of Sep 28 – Oct 4', 'stats', '[]', 'weekly_review')`)
	mustExec(`DELETE FROM journal_notes WHERE id = 'n3'`)
	mustExec(`INSERT INTO weekly_reviews (user_id, week_start, note_id) VALUES ('u1', '2026-09-28', 'n1')`)

	// Dirty-recovery re-runs the newest migration: it must be idempotent.
	mustExec(`UPDATE schema_migrations SET dirty = 1`)
	require.NoError(t, Migrate(conn))
	assertRows()
	var reviews int
	require.NoError(t, conn.QueryRow(`SELECT COUNT(*) FROM weekly_reviews`).Scan(&reviews))
	require.Equal(t, 1, reviews)
}
