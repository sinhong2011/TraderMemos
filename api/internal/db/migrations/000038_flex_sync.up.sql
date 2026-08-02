CREATE TABLE IF NOT EXISTS flex_sync_settings (
    account_id     TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token          TEXT NOT NULL,
    query_id       TEXT NOT NULL,
    enabled        INTEGER NOT NULL DEFAULT 1,
    last_synced_at TIMESTAMP,
    last_status    TEXT NOT NULL DEFAULT '',
    last_error     TEXT NOT NULL DEFAULT '',
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
