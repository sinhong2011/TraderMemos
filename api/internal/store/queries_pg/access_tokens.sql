-- name: CreateAccessToken :one
INSERT INTO access_tokens (
    id, user_id, name, token_prefix, token_hash, expires_at, created_at
) VALUES (
    $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
) RETURNING *;

-- name: ListAccessTokensByUser :many
SELECT *
FROM access_tokens
WHERE user_id = $1 AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: GetAccessTokenByHash :one
SELECT *
FROM access_tokens
WHERE token_hash = $1 AND revoked_at IS NULL;

-- name: RevokeAccessToken :execrows
UPDATE access_tokens
SET revoked_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: TouchAccessTokenLastUsed :exec
UPDATE access_tokens
SET last_used_at = CURRENT_TIMESTAMP
WHERE id = $1;
