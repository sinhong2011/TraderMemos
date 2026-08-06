CREATE TABLE IF NOT EXISTS access_token_uses (
    id         TEXT PRIMARY KEY,
    token_id   TEXT NOT NULL REFERENCES access_tokens(id) ON DELETE CASCADE,
    used_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip         TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_access_token_uses_token
    ON access_token_uses(token_id, used_at DESC);
