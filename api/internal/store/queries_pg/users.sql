-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: UpdateUserPassword :one
UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *;

-- name: UpdateUserTotpSecret :one
UPDATE users SET totp_secret = $1 WHERE id = $2 RETURNING *;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at ASC;

-- name: CountAdmins :one
SELECT COUNT(*) FROM users WHERE is_admin = 1;

-- name: SetUserAdmin :one
UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING *;

-- name: DeleteUser :execrows
DELETE FROM users WHERE id = $1;
