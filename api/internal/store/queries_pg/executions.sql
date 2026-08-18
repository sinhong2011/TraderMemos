-- name: InsertExecution :one
INSERT INTO executions (id, user_id, account_id, external_id, symbol, instrument_type, side,
    quantity, price, fees, commission, executed_at, multiplier, details, import_batch_id, dedup_hash)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *;

-- name: GetExecution :one
SELECT * FROM executions WHERE id = $1 AND user_id = $2;

-- name: GetExecutionByDedup :one
SELECT * FROM executions WHERE account_id = $1 AND dedup_hash = $2 LIMIT 1;

-- name: UpdateExecution :execrows
UPDATE executions
SET side = $1,
    quantity = $2,
    price = $3,
    fees = $4,
    commission = $5,
    executed_at = $6,
    dedup_hash = $7
WHERE id = $8 AND user_id = $9;

-- name: ListExecutionsForAccount :many
SELECT * FROM executions WHERE user_id = $1 AND account_id = $2 ORDER BY executed_at, id;

-- name: DeleteExecution :execrows
DELETE FROM executions WHERE id = $1 AND user_id = $2;

-- name: DeleteExecutionsForTrade :exec
DELETE FROM executions
WHERE user_id = $1
  AND id IN (SELECT execution_id FROM trade_executions WHERE trade_id = $2);

-- name: DeleteExecutionsForBatch :exec
DELETE FROM executions WHERE import_batch_id = $1 AND user_id = $2;

-- name: DeleteExecutionsForAccount :exec
DELETE FROM executions WHERE account_id = $1 AND user_id = $2;

-- name: ExecutionExists :one
SELECT CASE WHEN EXISTS(
  SELECT 1 FROM executions WHERE account_id = $1 AND dedup_hash = $2
) THEN 1::bigint ELSE 0::bigint END;

-- name: ListOptionExecutions :many
SELECT * FROM executions WHERE instrument_type = 'option' ORDER BY user_id, account_id, executed_at, id;

-- name: UpdateExecutionContract :exec
UPDATE executions
SET symbol = $1,
    details = $2,
    dedup_hash = $3
WHERE id = $4 AND user_id = $5;
