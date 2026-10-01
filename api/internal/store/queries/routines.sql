-- name: ListRoutineItems :many
SELECT * FROM routine_items
WHERE user_id = ?
ORDER BY position, created_at, id;

-- name: GetRoutineItem :one
SELECT * FROM routine_items WHERE id = ? AND user_id = ?;

-- name: CreateRoutineItem :one
INSERT INTO routine_items (id, user_id, title, stage, weekdays, position, start_day)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: SeedRoutineItem :exec
INSERT INTO routine_items (id, user_id, title, stage, weekdays, position, start_day)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (id) DO NOTHING;

-- name: UpdateRoutineItem :one
UPDATE routine_items
SET title = ?, stage = ?, weekdays = ?
WHERE id = ? AND user_id = ? AND end_day IS NULL
RETURNING *;

-- name: SetRoutineItemPosition :execrows
UPDATE routine_items SET position = ? WHERE id = ? AND user_id = ?;

-- name: ArchiveRoutineItem :execrows
UPDATE routine_items SET end_day = ?
WHERE id = ? AND user_id = ? AND end_day IS NULL;

-- name: ListRoutineChecks :many
SELECT * FROM routine_checks
WHERE user_id = ? AND day >= ? AND day <= ?
ORDER BY day, item_id;

-- name: InsertRoutineCheck :exec
INSERT INTO routine_checks (user_id, item_id, day)
VALUES (?, ?, ?)
ON CONFLICT (item_id, day) DO NOTHING;

-- name: DeleteRoutineCheck :execrows
DELETE FROM routine_checks WHERE item_id = ? AND day = ? AND user_id = ?;

-- name: MoveRoutineChecks :exec
UPDATE routine_checks SET item_id = ?
WHERE item_id = ? AND user_id = ? AND day >= ?;
