-- Add max_trades_per_day via table rebuild: SQLite has no ADD COLUMN IF NOT
-- EXISTS, and dirty-recovery re-runs the newest migration, so a bare ALTER
-- would fail with "duplicate column" (see migrate.go). risk_rules has no
-- child tables, so the rebuild cascades nothing.
--
-- The column sits AFTER updated_at: Postgres ADD COLUMN appends, and the
-- store→storepg struct conversions require both engines' column order (and
-- therefore sqlc field order) to match.
DROP TABLE IF EXISTS risk_rules_rebuild;
CREATE TABLE risk_rules_rebuild (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       REAL,   -- max $ risk on a single trade (null = unset)
    max_daily_loss           REAL,   -- max realized $ loss in a calendar day
    max_open_risk            REAL,   -- max sum of planned risk across open trades
    default_account_risk_pct REAL,   -- % of equity to risk when sizing (e.g. 1.0)
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_trades_per_day       INTEGER -- max closed trades in a calendar day (null = unset)
);
INSERT INTO risk_rules_rebuild (
    user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct, updated_at
)
SELECT user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct, updated_at
FROM risk_rules;
DROP TABLE risk_rules;
ALTER TABLE risk_rules_rebuild RENAME TO risk_rules;
