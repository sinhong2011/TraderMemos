DROP TABLE IF EXISTS risk_rules_rebuild;
CREATE TABLE risk_rules_rebuild (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       REAL,
    max_daily_loss           REAL,
    max_open_risk            REAL,
    default_account_risk_pct REAL,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_trades_per_day       INTEGER
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
