-- Trading system builder: the written rules (versioned), daily market regime,
-- and per-trade log card. New tables only — trade_journal is not rebuilt.
--
-- A system has versions (draft | active | retired). Exactly one may be active.
-- Trade cards stamp the version in force at entry and carry the per-trade
-- process fields the review measures against.

CREATE TABLE IF NOT EXISTS trading_systems (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT 'My system',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_systems_user ON trading_systems(user_id);

CREATE TABLE IF NOT EXISTS system_versions (
    id             TEXT PRIMARY KEY,
    system_id      TEXT NOT NULL REFERENCES trading_systems(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label          TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'draft', -- draft | active | retired
    rules          TEXT NOT NULL DEFAULT '{}',    -- JSON: decision id → {text, executable}
    open_questions TEXT NOT NULL DEFAULT '{}',    -- JSON: part → text
    regimes        TEXT NOT NULL DEFAULT '{}',    -- JSON: stance → label
    trade_types    TEXT NOT NULL DEFAULT '{}',    -- JSON: type key → label
    activated_at   TIMESTAMP,
    retired_at     TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_versions_user ON system_versions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_system_versions_system ON system_versions(system_id, created_at);

CREATE TABLE IF NOT EXISTS system_changes (
    id                 TEXT PRIMARY KEY,
    version_id         TEXT NOT NULL REFERENCES system_versions(id) ON DELETE CASCADE,
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision           TEXT NOT NULL,
    reason             TEXT NOT NULL, -- execution | regime | risk | other
    note               TEXT NOT NULL DEFAULT '',
    evidence_trade_ids TEXT NOT NULL DEFAULT '[]',
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_changes_version ON system_changes(version_id);

CREATE TABLE IF NOT EXISTS market_regime_days (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     TEXT NOT NULL, -- YYYY-MM-DD in market timezone
    regime  TEXT NOT NULL, -- normal | defensive | paused (or custom key)
    note    TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS trade_system_cards (
    trade_id         TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_id       TEXT REFERENCES system_versions(id) ON DELETE SET NULL,
    regime           TEXT NOT NULL DEFAULT '',
    trigger_met      TEXT NOT NULL DEFAULT '', -- yes | no | n.a. | ''
    trade_type       TEXT NOT NULL DEFAULT '',
    thesis           TEXT NOT NULL DEFAULT '',
    planned_hold_days INTEGER,
    time_stop_days   INTEGER,
    exit_state       TEXT NOT NULL DEFAULT '', -- wrong | not_working | finished | other
    adherence        TEXT NOT NULL DEFAULT '', -- full | partial | none
    checklist        TEXT NOT NULL DEFAULT '{}', -- JSON of 5 yes/no items
    lesson           TEXT NOT NULL DEFAULT '',
    rule_change      INTEGER NOT NULL DEFAULT 0,
    planned_at       TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trade_system_cards_user ON trade_system_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_system_cards_version ON trade_system_cards(version_id);
