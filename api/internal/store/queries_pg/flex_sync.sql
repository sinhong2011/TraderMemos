-- name: GetFlexSyncSettings :one
SELECT * FROM flex_sync_settings WHERE account_id = $1 AND user_id = $2;

-- name: UpsertFlexSyncSettings :one
INSERT INTO flex_sync_settings (account_id, user_id, token, query_id, enabled, updated_at)
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
ON CONFLICT(account_id) DO UPDATE SET
    token = excluded.token,
    query_id = excluded.query_id,
    enabled = excluded.enabled,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteFlexSyncSettings :execrows
DELETE FROM flex_sync_settings WHERE account_id = $1 AND user_id = $2;

-- name: ListEnabledFlexSyncSettings :many
SELECT * FROM flex_sync_settings WHERE enabled = 1 ORDER BY account_id;

-- name: UpdateFlexSyncStatus :exec
UPDATE flex_sync_settings
SET last_synced_at = $1, last_status = $2, last_error = $3
WHERE account_id = $4 AND user_id = $5;

-- name: ListFlexSyncSettingsForUser :many
SELECT f.*, a.name AS account_name
FROM flex_sync_settings f
JOIN accounts a ON a.id = f.account_id
WHERE f.user_id = $1
ORDER BY a.name;
