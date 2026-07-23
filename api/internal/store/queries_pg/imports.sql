-- name: CreateImportBatch :one
INSERT INTO import_batches (id, user_id, account_id, source, filename, column_mapping, row_count, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;

-- name: SetImportBatchStatus :exec
UPDATE import_batches SET status = $1 WHERE id = $2 AND user_id = $3;

-- name: ListImportBatches :many
SELECT * FROM import_batches WHERE user_id = $1 ORDER BY created_at DESC;

-- name: GetImportBatch :one
SELECT * FROM import_batches WHERE id = $1 AND user_id = $2;
