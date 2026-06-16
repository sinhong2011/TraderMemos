-- name: DeleteTradesForAccount :exec
DELETE FROM trades WHERE user_id = ? AND account_id = ?;

-- name: InsertTrade :one
INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: LinkTradeExecution :exec
INSERT INTO trade_executions (trade_id, execution_id) VALUES (?, ?);

-- name: GetTrade :one
SELECT * FROM trades WHERE id = ? AND user_id = ?;

-- name: UpdateTradeNotes :exec
UPDATE trades SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?;

-- name: ListClosedTrades :many
SELECT * FROM trades
WHERE user_id = ? AND status = 'closed'
  AND (sqlc.narg('account_id') IS NULL OR account_id = sqlc.narg('account_id'))
  AND (sqlc.narg('from') IS NULL OR closed_at >= sqlc.narg('from'))
  AND (sqlc.narg('to') IS NULL OR closed_at <= sqlc.narg('to'))
ORDER BY closed_at;
