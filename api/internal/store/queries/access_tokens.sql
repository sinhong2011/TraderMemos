-- name: CreateAccessToken :one
INSERT INTO access_tokens (
    id, user_id, name, token_prefix, token_hash, expires_at, created_at
) VALUES (
    ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
) RETURNING *;

-- name: ListAccessTokensByUser :many
SELECT *
FROM access_tokens
WHERE user_id = ? AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: GetAccessTokenByHash :one
SELECT *
FROM access_tokens
WHERE token_hash = ? AND revoked_at IS NULL;

-- name: RevokeAccessToken :execrows
UPDATE access_tokens
SET revoked_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND revoked_at IS NULL;

-- name: TouchAccessTokenLastUsed :exec
UPDATE access_tokens
SET last_used_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: RecordAccessTokenUse :exec
INSERT INTO access_token_uses (id, token_id, ip, user_agent)
VALUES (?, ?, ?, ?);

-- name: LatestAccessTokenUse :one
SELECT *
FROM access_token_uses
WHERE token_id = ?
ORDER BY used_at DESC
LIMIT 1;

-- name: ListAccessTokenUses :many
SELECT u.*
FROM access_token_uses u
JOIN access_tokens t ON t.id = u.token_id
WHERE u.token_id = ? AND t.user_id = ?
ORDER BY u.used_at DESC
LIMIT ?;

-- name: PruneAccessTokenUses :exec
DELETE FROM access_token_uses
WHERE access_token_uses.token_id = ?
  AND access_token_uses.id NOT IN (
      SELECT keep.id FROM access_token_uses keep
      WHERE keep.token_id = ?
      ORDER BY keep.used_at DESC
      LIMIT ?
  );
