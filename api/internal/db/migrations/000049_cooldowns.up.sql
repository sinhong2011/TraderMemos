-- Cooldown sessions: a timed pause a trader takes (or is handed by a tripped
-- risk rule) before trading again. The session stays open until the return
-- gate is answered — released_at is the moment the trader unlocked.
CREATE TABLE IF NOT EXISTS cooldown_sessions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at     TIMESTAMP NOT NULL,
    ends_at        TIMESTAMP NOT NULL,
    trigger        TEXT NOT NULL DEFAULT 'manual',  -- manual | loss_streak | daily_loss | trade_limit
    impulse        TEXT NOT NULL DEFAULT '',        -- revenge | fomo | boredom | fear | validation
    released_at    TIMESTAMP,                       -- return gate passed
    released_early INTEGER NOT NULL DEFAULT 0,      -- unlocked before ends_at
    setup_id       TEXT,                            -- the one setup allowed on return
    return_rule    TEXT NOT NULL DEFAULT '',        -- none | half_size | one_trade | done_for_day
    reflection     TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cooldown_sessions_user_started
    ON cooldown_sessions(user_id, started_at DESC);

-- Add the cooldown columns via table rebuild (idempotent; see 000044 for why
-- not a bare ALTER). Appended so the column order keeps matching the Postgres
-- schema — the store↔storepg struct conversions depend on it.
--
-- cooldown_enabled is the master switch and defaults to 0: cooldown mode is
-- opt-in, so a server that upgrades into this migration gains no new surface
-- until the trader turns it on.
DROP TABLE IF EXISTS risk_rules_rebuild;
CREATE TABLE risk_rules_rebuild (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       REAL,
    max_daily_loss           REAL,
    max_open_risk            REAL,
    default_account_risk_pct REAL,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_trades_per_day       INTEGER,
    max_consecutive_losses   INTEGER,
    cooldown_minutes         INTEGER, -- auto-start a cooldown this long when a rule trips (null = off)
    cooldown_enabled         INTEGER NOT NULL DEFAULT 0 -- master switch (0 = feature hidden)
);
INSERT INTO risk_rules_rebuild (
    user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct,
    updated_at, max_trades_per_day, max_consecutive_losses
)
SELECT user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct,
       updated_at, max_trades_per_day, max_consecutive_losses
FROM risk_rules;
DROP TABLE risk_rules;
ALTER TABLE risk_rules_rebuild RENAME TO risk_rules;
