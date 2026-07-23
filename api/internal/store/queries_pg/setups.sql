-- name: CreateSetup :one
INSERT INTO setups (id, user_id, name, description, thesis, symbol, direction, target_price, stop_price, checklist)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: ListSetups :many
SELECT * FROM setups WHERE user_id = $1 ORDER BY name;

-- name: GetSetup :one
SELECT * FROM setups WHERE id = $1 AND user_id = $2;

-- name: UpdateSetup :exec
UPDATE setups SET
    name = $1,
    description = $2,
    thesis = $3,
    symbol = $4,
    direction = $5,
    target_price = $6,
    stop_price = $7,
    checklist = $8
WHERE id = $9 AND user_id = $10;

-- name: DeleteSetup :execrows
DELETE FROM setups WHERE id = $1 AND user_id = $2;
