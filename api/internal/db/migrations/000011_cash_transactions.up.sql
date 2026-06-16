CREATE TABLE cash_transactions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,                 -- deposit|withdrawal|fee|dividend|interest|adjustment
    amount          REAL NOT NULL,                 -- signed
    currency        TEXT NOT NULL DEFAULT 'USD',
    occurred_at     TIMESTAMP NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cash_account ON cash_transactions(user_id, account_id, occurred_at);
