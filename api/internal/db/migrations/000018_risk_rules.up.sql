CREATE TABLE risk_rules (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       REAL,   -- max $ risk on a single trade (null = unset)
    max_daily_loss           REAL,   -- max realized $ loss in a calendar day
    max_open_risk            REAL,   -- max sum of planned risk across open trades
    default_account_risk_pct REAL,   -- % of equity to risk when sizing (e.g. 1.0)
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
