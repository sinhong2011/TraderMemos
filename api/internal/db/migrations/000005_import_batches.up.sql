CREATE TABLE import_batches (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source         TEXT NOT NULL,                 -- csv|manual|api
    filename       TEXT,
    column_mapping TEXT,                          -- JSON
    row_count      INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending', -- pending|committed|reversed
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_import_batches_user ON import_batches(user_id);
