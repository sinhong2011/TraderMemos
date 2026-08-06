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
