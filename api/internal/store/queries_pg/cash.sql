-- name: InsertCashTransaction :one
INSERT INTO cash_transactions (id, user_id, account_id, type, amount, currency, occurred_at, note, import_batch_id, trade_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;

-- name: ListCashTransactions :many
SELECT * FROM cash_transactions
WHERE user_id = $1 AND (sqlc.narg('account_id') IS NULL OR account_id = sqlc.narg('account_id'))
ORDER BY occurred_at;

-- name: ListCashForTrade :many
SELECT * FROM cash_transactions
WHERE user_id = $1 AND trade_id = $2
ORDER BY occurred_at;

-- name: DeleteCashTransaction :execrows
DELETE FROM cash_transactions WHERE id = $1 AND user_id = $2;

-- name: UpdateCashTransaction :one
UPDATE cash_transactions
SET type = $1, amount = $2, currency = $3, occurred_at = $4, note = $5
WHERE id = $6 AND user_id = $7
RETURNING *;
