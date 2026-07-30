-- name: GetAnnualGoal :one
SELECT user_id, year, amount, updated_at
FROM annual_goals
WHERE user_id = ? AND year = ?;

-- name: UpsertAnnualGoal :one
INSERT INTO annual_goals (user_id, year, amount, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, year) DO UPDATE SET
    amount = excluded.amount,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeleteAnnualGoal :execrows
DELETE FROM annual_goals
WHERE user_id = ? AND year = ?;
