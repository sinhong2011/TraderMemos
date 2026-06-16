CREATE TABLE accounts (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    broker           TEXT NOT NULL DEFAULT '',
    account_type     TEXT NOT NULL DEFAULT 'cash',   -- cash|margin|prop
    base_currency    TEXT NOT NULL DEFAULT 'USD',
    starting_balance REAL NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_accounts_user ON accounts(user_id);
