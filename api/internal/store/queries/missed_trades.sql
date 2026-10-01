-- name: ListMissedTrades :many
SELECT * FROM missed_trades
WHERE user_id = ?
ORDER BY observed_at DESC, created_at DESC, id;

-- name: GetMissedTrade :one
SELECT * FROM missed_trades WHERE id = ? AND user_id = ?;

-- name: CreateMissedTrade :one
INSERT INTO missed_trades (
    id, user_id, account_id, setup_id, symbol, direction, observed_at,
    entry, stop, target, reason, outcome, notes
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateMissedTrade :one
UPDATE missed_trades
SET account_id = ?, setup_id = ?, symbol = ?, direction = ?, observed_at = ?,
    entry = ?, stop = ?, target = ?, reason = ?, outcome = ?, notes = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: DeleteMissedTrade :execrows
DELETE FROM missed_trades WHERE id = ? AND user_id = ?;
