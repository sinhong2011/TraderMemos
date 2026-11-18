-- name: GetMCPSettings :one
SELECT * FROM mcp_settings WHERE user_id = ?;

-- name: UpsertMCPSettings :one
INSERT INTO mcp_settings (user_id, enabled, allow_writes, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    enabled = excluded.enabled,
    allow_writes = excluded.allow_writes,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
