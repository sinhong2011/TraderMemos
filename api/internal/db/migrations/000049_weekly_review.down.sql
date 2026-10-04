DROP TABLE IF EXISTS weekly_reviews;

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
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
