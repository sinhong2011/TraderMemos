-- name: GetFlexSyncSettings :one
SELECT * FROM flex_sync_settings WHERE account_id = ? AND user_id = ?;

-- name: UpsertFlexSyncSettings :one
INSERT INTO flex_sync_settings (account_id, user_id, token, query_id, enabled, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(account_id) DO UPDATE SET
    token = excluded.token,
    query_id = excluded.query_id,
    enabled = excluded.enabled,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteFlexSyncSettings :execrows
DELETE FROM flex_sync_settings WHERE account_id = ? AND user_id = ?;

-- name: ListEnabledFlexSyncSettings :many
SELECT * FROM flex_sync_settings WHERE enabled = 1 ORDER BY account_id;

-- name: UpdateFlexSyncStatus :exec
UPDATE flex_sync_settings
SET last_synced_at = ?, last_status = ?, last_error = ?
WHERE account_id = ? AND user_id = ?;
