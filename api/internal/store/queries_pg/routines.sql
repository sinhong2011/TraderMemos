-- name: ListRoutineItems :many
SELECT * FROM routine_items
WHERE user_id = $1
ORDER BY position, created_at, id;

-- name: GetRoutineItem :one
SELECT * FROM routine_items WHERE id = $1 AND user_id = $2;

-- name: CreateRoutineItem :one
INSERT INTO routine_items (id, user_id, title, stage, weekdays, position, start_day)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: SeedRoutineItem :exec
INSERT INTO routine_items (id, user_id, title, stage, weekdays, position, start_day)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO NOTHING;

-- name: UpdateRoutineItem :one
UPDATE routine_items
SET title = $1, stage = $2, weekdays = $3
WHERE id = $4 AND user_id = $5 AND end_day IS NULL
RETURNING *;

-- name: SetRoutineItemPosition :execrows
UPDATE routine_items SET position = $1 WHERE id = $2 AND user_id = $3;

-- name: ArchiveRoutineItem :execrows
UPDATE routine_items SET end_day = $1
WHERE id = $2 AND user_id = $3 AND end_day IS NULL;

-- name: ListRoutineChecks :many
SELECT * FROM routine_checks
WHERE user_id = $1 AND day >= $2 AND day <= $3
ORDER BY day, item_id;

-- name: InsertRoutineCheck :exec
INSERT INTO routine_checks (user_id, item_id, day)
VALUES ($1, $2, $3)
ON CONFLICT (item_id, day) DO NOTHING;

-- name: DeleteRoutineCheck :execrows
DELETE FROM routine_checks WHERE item_id = $1 AND day = $2 AND user_id = $3;

-- name: MoveRoutineChecks :exec
UPDATE routine_checks SET item_id = $1
WHERE item_id = $2 AND user_id = $3 AND day >= $4;
