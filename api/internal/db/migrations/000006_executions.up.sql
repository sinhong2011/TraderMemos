CREATE TABLE executions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id     TEXT,
    symbol          TEXT NOT NULL,
    instrument_type TEXT NOT NULL,
    side            TEXT NOT NULL,                 -- buy|sell
    quantity        REAL NOT NULL,
    price           REAL NOT NULL,
    fees            REAL NOT NULL DEFAULT 0,
    commission      REAL NOT NULL DEFAULT 0,
    executed_at     TIMESTAMP NOT NULL,
    multiplier      REAL NOT NULL DEFAULT 1,
    details         TEXT,                          -- JSON
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    dedup_hash      TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_exec_group ON executions(user_id, account_id, symbol, instrument_type, executed_at);
CREATE UNIQUE INDEX idx_exec_dedup ON executions(account_id, dedup_hash);
