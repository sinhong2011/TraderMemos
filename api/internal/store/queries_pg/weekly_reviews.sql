-- name: GetWeeklyReview :one
SELECT * FROM weekly_reviews WHERE user_id = $1 AND week_start = $2;

-- name: UpsertWeeklyReviewNote :exec
INSERT INTO weekly_reviews (user_id, week_start, note_id, created_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, week_start) DO UPDATE SET note_id = excluded.note_id;

-- name: MarkWeeklyReviewSent :exec
UPDATE weekly_reviews SET sent_at = $1 WHERE user_id = $2 AND week_start = $3;
