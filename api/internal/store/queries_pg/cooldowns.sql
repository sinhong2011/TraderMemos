-- name: CreateCooldownSession :one
INSERT INTO cooldown_sessions (id, user_id, started_at, ends_at, trigger, impulse)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCooldownSession :one
SELECT * FROM cooldown_sessions WHERE id = $1 AND user_id = $2;

-- name: GetOpenCooldownSession :one
SELECT * FROM cooldown_sessions
WHERE user_id = $1 AND released_at IS NULL
ORDER BY started_at DESC LIMIT 1;

-- name: ListCooldownSessions :many
SELECT * FROM cooldown_sessions WHERE user_id = $1 ORDER BY started_at DESC;

-- name: ExtendCooldownSession :one
UPDATE cooldown_sessions SET ends_at = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: ReleaseCooldownSession :one
UPDATE cooldown_sessions SET
    released_at = $1,
    released_early = $2,
    impulse = $3,
    setup_id = $4,
    return_rule = $5,
    reflection = $6,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $7 AND user_id = $8
RETURNING *;

-- name: DeleteCooldownSession :execrows
DELETE FROM cooldown_sessions WHERE id = $1 AND user_id = $2;
