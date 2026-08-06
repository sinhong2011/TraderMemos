-- Where a personal access token was used from. `access_tokens.last_used_at` is
-- a single overwritten stamp: it answers "recently?" but never "by what?", so
-- a leaked token looks identical to a working cron job.
--
-- A new table, not a column on access_tokens — appending rows never touches
-- the parent, and this is unbounded per token.
CREATE TABLE IF NOT EXISTS access_token_uses (
    id         TEXT PRIMARY KEY,
    token_id   TEXT NOT NULL REFERENCES access_tokens(id) ON DELETE CASCADE,
    used_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip         TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT ''
);

-- Every read is "newest uses for this token".
CREATE INDEX IF NOT EXISTS idx_access_token_uses_token
    ON access_token_uses(token_id, used_at DESC);
