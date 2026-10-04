-- Weekly review: a Saturday push that opens a prefilled review note.
--
-- alert_settings gains rule_weekly_review via a table rebuild: SQLite has no
-- ADD COLUMN IF NOT EXISTS, and dirty-recovery re-runs the newest migration,
-- so a bare ALTER would fail with "duplicate column" (see migrate.go). Nothing
-- references alert_settings, so dropping it cascades nowhere. The new column
-- goes last to match the Postgres ALTER, which appends — both dialects then
-- generate the same struct field order.
DROP TABLE IF EXISTS alert_settings_rebuild;
CREATE TABLE alert_settings_rebuild (
    user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled            INTEGER NOT NULL DEFAULT 0,
    timezone           TEXT NOT NULL DEFAULT '',
    rule_risk          INTEGER NOT NULL DEFAULT 1,
    rule_daily_loss    INTEGER NOT NULL DEFAULT 1,
    rule_loss_streak   INTEGER NOT NULL DEFAULT 1,
    loss_streak_n      INTEGER NOT NULL DEFAULT 3,
    rule_prop_drawdown INTEGER NOT NULL DEFAULT 1,
    prop_warn_pct      REAL NOT NULL DEFAULT 0.8,
    rule_unreviewed    INTEGER NOT NULL DEFAULT 1,
    unreviewed_days    INTEGER NOT NULL DEFAULT 7,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rule_weekly_review INTEGER NOT NULL DEFAULT 1
);
INSERT INTO alert_settings_rebuild (
    user_id, enabled, timezone, rule_risk, rule_daily_loss, rule_loss_streak,
    loss_streak_n, rule_prop_drawdown, prop_warn_pct, rule_unreviewed,
    unreviewed_days, updated_at
)
SELECT user_id, enabled, timezone, rule_risk, rule_daily_loss, rule_loss_streak,
       loss_streak_n, rule_prop_drawdown, prop_warn_pct, rule_unreviewed,
       unreviewed_days, updated_at
FROM alert_settings;
DROP TABLE alert_settings;
ALTER TABLE alert_settings_rebuild RENAME TO alert_settings;

-- One row per (user, week reviewed): which note the review lives in, and
-- whether the push went out. The job runner is stateless, so this ledger is
-- what keeps a restart from creating a second note or re-sending the push.
-- week_start is the Monday (YYYY-MM-DD) in the user's market timezone.
-- journal_notes.note_type has no CHECK constraint, so the new
-- 'weekly_review' type needs no change there.
CREATE TABLE IF NOT EXISTS weekly_reviews (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    note_id    TEXT NOT NULL DEFAULT '',
    sent_at    TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, week_start)
);
