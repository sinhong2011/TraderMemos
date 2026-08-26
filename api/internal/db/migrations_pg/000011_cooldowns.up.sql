-- Cooldown sessions (see the SQLite migration of the same name).
CREATE TABLE IF NOT EXISTS cooldown_sessions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at     TIMESTAMPTZ NOT NULL,
    ends_at        TIMESTAMPTZ NOT NULL,
    trigger        TEXT NOT NULL DEFAULT 'manual',
    impulse        TEXT NOT NULL DEFAULT '',
    released_at    TIMESTAMPTZ,
    released_early INTEGER NOT NULL DEFAULT 0,
    setup_id       TEXT,
    return_rule    TEXT NOT NULL DEFAULT '',
    reflection     TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cooldown_sessions_user_started
    ON cooldown_sessions(user_id, started_at DESC);

-- Auto-start a cooldown this long when a rule trips (null = off). Appended to
-- keep the column order matching SQLite (store↔storepg struct conversions).
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER;
