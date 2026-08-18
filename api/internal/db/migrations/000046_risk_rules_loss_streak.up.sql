-- Add max_consecutive_losses via table rebuild (idempotent; see 000044 for
-- why not a bare ALTER). Appended so the column order keeps matching the
-- Postgres schema — the store↔storepg struct conversions depend on it.
DROP TABLE IF EXISTS risk_rules_rebuild;
CREATE TABLE risk_rules_rebuild (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       REAL,   -- max $ risk on a single trade (null = unset)
    max_daily_loss           REAL,   -- max realized $ loss in a calendar day
    max_open_risk            REAL,   -- max sum of planned risk across open trades
    default_account_risk_pct REAL,   -- % of equity to risk when sizing (e.g. 1.0)
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_trades_per_day       INTEGER, -- max closed trades in a calendar day (null = unset)
    max_consecutive_losses   INTEGER  -- stop after this many losing closes in a row (null = unset)
);
INSERT INTO risk_rules_rebuild (
    user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct,
    updated_at, max_trades_per_day
)
SELECT user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct,
       updated_at, max_trades_per_day
FROM risk_rules;
DROP TABLE risk_rules;
ALTER TABLE risk_rules_rebuild RENAME TO risk_rules;
