-- name: CreateSetup :one
INSERT INTO setups (id, user_id, name, description, thesis, symbol, direction, target_price, stop_price, checklist)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListSetups :many
SELECT * FROM setups WHERE user_id = ? ORDER BY name;

-- name: GetSetup :one
SELECT * FROM setups WHERE id = ? AND user_id = ?;

-- name: UpdateSetup :exec
UPDATE setups SET
    name = ?,
    description = ?,
    thesis = ?,
    symbol = ?,
    direction = ?,
    target_price = ?,
    stop_price = ?,
    checklist = ?
WHERE id = ? AND user_id = ?;

-- name: DeleteSetup :execrows
DELETE FROM setups WHERE id = ? AND user_id = ?;
