-- Revocable read-only share links. The token is the whole credential: it is
-- random (256-bit), lives in the URL, and the owner must be able to re-copy
-- the link later, so it is stored as-is rather than hashed. scope_json holds
-- the filter snapshot (accounts, date range) and the field allowlist that the
-- public serializer enforces server-side.
CREATE TABLE IF NOT EXISTS share_links (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    scope_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_share_links_user ON share_links(user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
