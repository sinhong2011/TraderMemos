-- name: CreateCoachReview :one
INSERT INTO coach_reviews (id, user_id, trade_id, model, notes, next_action)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListCoachReviews :many
SELECT * FROM coach_reviews
WHERE user_id = $1 AND trade_id = $2
ORDER BY created_at DESC, id DESC
LIMIT $3;

-- name: DeleteCoachReview :execrows
DELETE FROM coach_reviews WHERE id = $1 AND user_id = $2;
