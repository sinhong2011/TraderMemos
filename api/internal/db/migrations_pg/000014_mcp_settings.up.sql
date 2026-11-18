-- MCP endpoint switches. See the SQLite twin (000050_mcp_settings).
CREATE TABLE IF NOT EXISTS mcp_settings (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled      INTEGER NOT NULL DEFAULT 0,
    allow_writes INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
