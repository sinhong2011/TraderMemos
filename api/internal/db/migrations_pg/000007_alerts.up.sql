CREATE TABLE IF NOT EXISTS alert_settings (
    user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled            INTEGER NOT NULL DEFAULT 0,
    timezone           TEXT NOT NULL DEFAULT '',
    rule_risk          INTEGER NOT NULL DEFAULT 1,
    rule_daily_loss    INTEGER NOT NULL DEFAULT 1,
    rule_loss_streak   INTEGER NOT NULL DEFAULT 1,
    loss_streak_n      INTEGER NOT NULL DEFAULT 3,
    rule_prop_drawdown INTEGER NOT NULL DEFAULT 1,
    prop_warn_pct      DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    rule_unreviewed    INTEGER NOT NULL DEFAULT 1,
    unreviewed_days    INTEGER NOT NULL DEFAULT 7,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_channels (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL,
    target       TEXT NOT NULL,
    label        TEXT NOT NULL DEFAULT '',
    enabled      INTEGER NOT NULL DEFAULT 1,
    last_sent_at TIMESTAMPTZ,
    last_status  TEXT NOT NULL DEFAULT '',
    last_error   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alert_channels_user ON alert_channels(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_channels_user_target ON alert_channels(user_id, kind, target);

CREATE TABLE IF NOT EXISTS alert_events (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule       TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    fired_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_dedupe ON alert_events(user_id, rule, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_fired ON alert_events(user_id, fired_at);
