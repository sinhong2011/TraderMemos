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

-- name: RecordAccessTokenUse :exec
INSERT INTO access_token_uses (id, token_id, ip, user_agent)
VALUES ($1, $2, $3, $4);

-- name: LatestAccessTokenUse :one
SELECT *
FROM access_token_uses
WHERE token_id = $1
ORDER BY used_at DESC
LIMIT 1;

-- name: ListAccessTokenUses :many
SELECT u.*
FROM access_token_uses u
JOIN access_tokens t ON t.id = u.token_id
WHERE u.token_id = $1 AND t.user_id = $2
ORDER BY u.used_at DESC
LIMIT $3;

-- name: PruneAccessTokenUses :exec
DELETE FROM access_token_uses
WHERE access_token_uses.token_id = $1
  AND access_token_uses.id NOT IN (
      SELECT keep.id FROM access_token_uses keep
      WHERE keep.token_id = $2
      ORDER BY keep.used_at DESC
      LIMIT $3
  );
