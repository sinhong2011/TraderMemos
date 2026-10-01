-- name: ListMissedTrades :many
SELECT * FROM missed_trades
WHERE user_id = $1
ORDER BY observed_at DESC, created_at DESC, id;

-- name: GetMissedTrade :one
SELECT * FROM missed_trades WHERE id = $1 AND user_id = $2;

-- name: CreateMissedTrade :one
INSERT INTO missed_trades (
    id, user_id, account_id, setup_id, symbol, direction, observed_at,
    entry, stop, target, reason, outcome, notes
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: UpdateMissedTrade :one
UPDATE missed_trades
SET account_id = $1, setup_id = $2, symbol = $3, direction = $4, observed_at = $5,
    entry = $6, stop = $7, target = $8, reason = $9, outcome = $10, notes = $11,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $12 AND user_id = $13
RETURNING *;

-- name: DeleteMissedTrade :execrows
DELETE FROM missed_trades WHERE id = $1 AND user_id = $2;
