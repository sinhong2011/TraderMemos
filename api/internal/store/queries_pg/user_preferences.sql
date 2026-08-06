-- name: GetUserPreferences :one
SELECT user_id, prefs, updated_at FROM user_preferences WHERE user_id = $1;

-- name: UpsertUserPreferences :one
INSERT INTO user_preferences (user_id, prefs, updated_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    prefs = excluded.prefs,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
