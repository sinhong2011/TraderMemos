-- name: GetMCPSettings :one
SELECT * FROM mcp_settings WHERE user_id = $1;

-- name: UpsertMCPSettings :one
INSERT INTO mcp_settings (user_id, enabled, allow_writes, updated_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    enabled = excluded.enabled,
    allow_writes = excluded.allow_writes,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
