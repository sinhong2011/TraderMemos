-- name: CreateShareLink :one
INSERT INTO share_links (
    id, user_id, token, scope_json, expires_at, created_at
) VALUES (
    $1, $2, $3, $4, $5, CURRENT_TIMESTAMP
) RETURNING *;

-- name: ListShareLinksByUser :many
SELECT *
FROM share_links
WHERE user_id = $1 AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: GetShareLinkByToken :one
SELECT *
FROM share_links
WHERE token = $1 AND revoked_at IS NULL;

-- name: RevokeShareLink :execrows
UPDATE share_links
SET revoked_at = CURRENT_TIMESTAMP
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: IncrementShareLinkViews :exec
UPDATE share_links
SET view_count = view_count + 1
WHERE id = $1;
