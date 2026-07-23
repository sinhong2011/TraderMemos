-- name: InsertAttachment :one
INSERT INTO trade_attachments (id, user_id, trade_id, filename, content_type, size_bytes, storage_key)
VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListAttachmentsForTrade :many
SELECT * FROM trade_attachments WHERE trade_id = ? AND user_id = ? ORDER BY created_at;

-- name: ListAttachmentsForAccount :many
SELECT a.* FROM trade_attachments a
INNER JOIN trades t ON t.id = a.trade_id
WHERE a.user_id = ? AND t.account_id = ?
ORDER BY a.created_at;

-- name: GetAttachment :one
SELECT * FROM trade_attachments WHERE id = ? AND user_id = ?;

-- name: DeleteAttachment :execrows
DELETE FROM trade_attachments WHERE id = ? AND user_id = ?;

-- name: InsertMediaFile :one
INSERT INTO media_files (id, user_id, filename, content_type, size_bytes, storage_key)
VALUES (?, ?, ?, ?, ?, ?) RETURNING *;

-- name: GetMediaFile :one
SELECT * FROM media_files WHERE id = ? AND user_id = ?;

-- name: DeleteMediaFile :execrows
DELETE FROM media_files WHERE id = ? AND user_id = ?;

-- name: ListMediaFilesForUser :many
SELECT * FROM media_files WHERE user_id = ? ORDER BY created_at;
