-- name: InsertAttachment :one
INSERT INTO trade_attachments (id, user_id, trade_id, filename, content_type, size_bytes, storage_key)
VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListAttachmentsForTrade :many
SELECT * FROM trade_attachments WHERE trade_id = ? AND user_id = ? ORDER BY created_at;

-- name: GetAttachment :one
SELECT * FROM trade_attachments WHERE id = ? AND user_id = ?;

-- name: DeleteAttachment :execrows
DELETE FROM trade_attachments WHERE id = ? AND user_id = ?;
