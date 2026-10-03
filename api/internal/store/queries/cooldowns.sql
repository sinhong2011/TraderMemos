-- name: CreateCooldownSession :one
INSERT INTO cooldown_sessions (id, user_id, started_at, ends_at, trigger, impulse)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: GetCooldownSession :one
SELECT * FROM cooldown_sessions WHERE id = ? AND user_id = ?;

-- name: GetOpenCooldownSession :one
SELECT * FROM cooldown_sessions
WHERE user_id = ? AND released_at IS NULL
ORDER BY started_at DESC LIMIT 1;

-- name: ListCooldownSessions :many
SELECT * FROM cooldown_sessions WHERE user_id = ? ORDER BY started_at DESC;

-- name: ExtendCooldownSession :one
UPDATE cooldown_sessions SET ends_at = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: ReleaseCooldownSession :one
UPDATE cooldown_sessions SET
    released_at = ?,
    released_early = ?,
    impulse = ?,
    setup_id = ?,
    return_rule = ?,
    reflection = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: DeleteCooldownSession :execrows
DELETE FROM cooldown_sessions WHERE id = ? AND user_id = ?;
