-- name: CreateShareLink :one
INSERT INTO share_links (
    id, user_id, token, scope_json, expires_at, created_at
) VALUES (
    ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
) RETURNING *;

-- name: ListShareLinksByUser :many
SELECT *
FROM share_links
WHERE user_id = ? AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: GetShareLinkByToken :one
SELECT *
FROM share_links
WHERE token = ? AND revoked_at IS NULL;

-- name: RevokeShareLink :execrows
UPDATE share_links
SET revoked_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND revoked_at IS NULL;

-- name: IncrementShareLinkViews :exec
UPDATE share_links
SET view_count = view_count + 1
WHERE id = ?;
