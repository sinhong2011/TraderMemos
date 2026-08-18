-- name: CreateCoachReview :one
INSERT INTO coach_reviews (id, user_id, trade_id, model, notes, next_action)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListCoachReviews :many
SELECT * FROM coach_reviews
WHERE user_id = ? AND trade_id = ?
ORDER BY created_at DESC, id DESC
LIMIT ?;

-- name: DeleteCoachReview :execrows
DELETE FROM coach_reviews WHERE id = ? AND user_id = ?;
