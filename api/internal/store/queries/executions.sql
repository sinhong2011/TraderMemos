-- name: InsertExecution :one
INSERT INTO executions (id, user_id, account_id, external_id, symbol, instrument_type, side,
    quantity, price, fees, commission, executed_at, multiplier, details, import_batch_id, dedup_hash)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: GetExecution :one
SELECT * FROM executions WHERE id = ? AND user_id = ?;

-- name: GetExecutionByDedup :one
SELECT * FROM executions WHERE account_id = ? AND dedup_hash = ? LIMIT 1;

-- name: UpdateExecution :execrows
UPDATE executions
SET side = ?,
    quantity = ?,
    price = ?,
    fees = ?,
    commission = ?,
    executed_at = ?,
    dedup_hash = ?
WHERE id = ? AND user_id = ?;

-- name: ListExecutionsForAccount :many
SELECT * FROM executions WHERE user_id = ? AND account_id = ? ORDER BY executed_at, id;

-- name: DeleteExecution :execrows
DELETE FROM executions WHERE id = ? AND user_id = ?;

-- name: DeleteExecutionsForTrade :exec
DELETE FROM executions
WHERE user_id = ?
  AND id IN (SELECT execution_id FROM trade_executions WHERE trade_id = ?);

-- name: DeleteExecutionsForBatch :exec
DELETE FROM executions WHERE import_batch_id = ? AND user_id = ?;

-- name: DeleteExecutionsForAccount :exec
DELETE FROM executions WHERE account_id = ? AND user_id = ?;

-- name: ExecutionExists :one
SELECT EXISTS(SELECT 1 FROM executions WHERE account_id = ? AND dedup_hash = ?);
