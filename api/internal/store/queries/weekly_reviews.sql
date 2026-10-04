-- name: GetWeeklyReview :one
SELECT * FROM weekly_reviews WHERE user_id = ? AND week_start = ?;

-- name: UpsertWeeklyReviewNote :exec
INSERT INTO weekly_reviews (user_id, week_start, note_id, created_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, week_start) DO UPDATE SET note_id = excluded.note_id;

-- name: MarkWeeklyReviewSent :exec
UPDATE weekly_reviews SET sent_at = ? WHERE user_id = ? AND week_start = ?;
