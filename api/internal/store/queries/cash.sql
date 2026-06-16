-- name: InsertCashTransaction :one
INSERT INTO cash_transactions (id, user_id, account_id, type, amount, currency, occurred_at, note, import_batch_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListCashTransactions :many
SELECT * FROM cash_transactions
WHERE user_id = ? AND (sqlc.narg('account_id') IS NULL OR account_id = sqlc.narg('account_id'))
ORDER BY occurred_at;

-- name: DeleteCashTransaction :execrows
DELETE FROM cash_transactions WHERE id = ? AND user_id = ?;
