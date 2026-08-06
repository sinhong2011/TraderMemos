-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, is_admin) VALUES (?, ?, ?, ?) RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: UpdateUserPassword :one
UPDATE users SET password_hash = ? WHERE id = ? RETURNING *;

-- name: UpdateUserTotpSecret :one
UPDATE users SET totp_secret = ? WHERE id = ? RETURNING *;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at ASC;

-- name: CountAdmins :one
SELECT COUNT(*) FROM users WHERE is_admin = 1;

-- name: SetUserAdmin :one
UPDATE users SET is_admin = ? WHERE id = ? RETURNING *;

-- name: DeleteUser :execrows
DELETE FROM users WHERE id = ?;
