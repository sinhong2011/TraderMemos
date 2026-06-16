-- name: CreateImportBatch :one
INSERT INTO import_batches (id, user_id, account_id, source, filename, column_mapping, row_count, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: SetImportBatchStatus :exec
UPDATE import_batches SET status = ? WHERE id = ? AND user_id = ?;

-- name: ListImportBatches :many
SELECT * FROM import_batches WHERE user_id = ? ORDER BY created_at DESC;

-- name: GetImportBatch :one
SELECT * FROM import_batches WHERE id = ? AND user_id = ?;
