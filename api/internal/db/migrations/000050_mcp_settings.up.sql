-- Per-user switches for the MCP (Model Context Protocol) endpoint that lets
-- external AI assistants operate the journal with a personal access token.
-- Both default off: a token that already exists must not start answering MCP
-- clients — or writing through them — until its owner opts in.
CREATE TABLE IF NOT EXISTS mcp_settings (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled      INTEGER NOT NULL DEFAULT 0,
    allow_writes INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
