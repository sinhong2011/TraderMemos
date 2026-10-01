-- Missed trades: setups seen and not taken. Kept apart from executions and
-- trades on purpose, so they never touch P&L, win rate or any trade stat.
--
-- outcome is filled in afterwards (unknown | target | stop | no_trigger) and,
-- with entry/stop/target, prices what the miss would have made in R. reason
-- (hesitated | away | rules | other, or '') groups that cost by cause.
CREATE TABLE IF NOT EXISTS missed_trades (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    setup_id    TEXT REFERENCES setups(id) ON DELETE SET NULL,
    symbol      TEXT NOT NULL,
    direction   TEXT NOT NULL,
    observed_at TIMESTAMP NOT NULL,
    entry       REAL,
    stop        REAL,
    target      REAL,
    reason      TEXT NOT NULL DEFAULT '',
    outcome     TEXT NOT NULL DEFAULT 'unknown',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_missed_trades_user ON missed_trades(user_id, observed_at);
