-- name: CreateAccount :one
INSERT INTO accounts (id, user_id, name, broker, account_type, base_currency, starting_balance)
VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListAccounts :many
SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = ? AND user_id = ?;

-- name: DeleteAccount :execrows
DELETE FROM accounts WHERE id = ? AND user_id = ?;

-- name: GetAccountByIDAny :one
SELECT * FROM accounts WHERE id = ?;
