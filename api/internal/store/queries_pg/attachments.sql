-- name: InsertAttachment :one
INSERT INTO trade_attachments (id, user_id, trade_id, filename, content_type, size_bytes, storage_key)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: ListAttachmentsForTrade :many
SELECT * FROM trade_attachments WHERE trade_id = $1 AND user_id = $2 ORDER BY created_at;

-- name: ListAttachmentsForAccount :many
SELECT a.* FROM trade_attachments a
INNER JOIN trades t ON t.id = a.trade_id
WHERE a.user_id = $1 AND t.account_id = $2
ORDER BY a.created_at;

-- name: GetAttachment :one
SELECT * FROM trade_attachments WHERE id = $1 AND user_id = $2;

-- name: DeleteAttachment :execrows
DELETE FROM trade_attachments WHERE id = $1 AND user_id = $2;

-- name: InsertMediaFile :one
INSERT INTO media_files (id, user_id, filename, content_type, size_bytes, storage_key)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: GetMediaFile :one
SELECT * FROM media_files WHERE id = $1 AND user_id = $2;

-- name: DeleteMediaFile :execrows
DELETE FROM media_files WHERE id = $1 AND user_id = $2;

-- name: ListMediaFilesForUser :many
SELECT * FROM media_files WHERE user_id = $1 ORDER BY created_at;
