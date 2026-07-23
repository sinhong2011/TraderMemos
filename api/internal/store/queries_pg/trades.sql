-- name: DeleteTradesForAccount :exec
DELETE FROM trades WHERE user_id = $1 AND account_id = $2;

-- name: DeleteTrade :execrows
DELETE FROM trades WHERE id = $1 AND user_id = $2;

-- name: InsertTrade :one
INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, qty_remaining, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *;

-- name: LinkTradeExecution :exec
INSERT INTO trade_executions (trade_id, execution_id) VALUES ($1, $2);

-- name: GetTrade :one
SELECT * FROM trades WHERE id = $1 AND user_id = $2;

-- name: UpdateTradeNotes :exec
UPDATE trades SET notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3;

-- name: ListClosedTrades :many
SELECT * FROM trades
WHERE user_id = $1 AND status = 'closed'
  AND (account_id = COALESCE(sqlc.narg('account_id'), account_id))
  AND (closed_at >= COALESCE(sqlc.narg('from')::timestamp, closed_at))
  AND (closed_at <= COALESCE(sqlc.narg('to')::timestamp, closed_at))
ORDER BY closed_at;

-- name: ListTrades :many
SELECT * FROM trades
WHERE user_id = $1
  AND (account_id = COALESCE(sqlc.narg('account_id'), account_id))
  AND (status = COALESCE(sqlc.narg('status'), status))
ORDER BY opened_at DESC;

-- name: UpsertTrade :exec
INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, qty_remaining, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, '')
ON CONFLICT(id) DO UPDATE SET
    account_id = excluded.account_id, symbol = excluded.symbol,
    instrument_type = excluded.instrument_type, direction = excluded.direction,
    status = excluded.status, opened_at = excluded.opened_at, closed_at = excluded.closed_at,
    qty_opened = excluded.qty_opened, qty_remaining = excluded.qty_remaining,
    avg_entry_price = excluded.avg_entry_price,
    avg_exit_price = excluded.avg_exit_price, gross_pnl = excluded.gross_pnl,
    fees_total = excluded.fees_total, net_pnl = excluded.net_pnl,
    pnl_currency = excluded.pnl_currency, return_pct = excluded.return_pct,
    time_in_trade_secs = excluded.time_in_trade_secs, updated_at = CURRENT_TIMESTAMP;

-- name: DeleteTradesNotInAccount :exec
-- NOTE: sqlc+database/sql emits a broken single-$3 slice expand for Postgres.
-- storepg/trades.sql.go implements placeholder expansion manually; re-check after `make sqlc`.
DELETE FROM trades WHERE user_id = $1 AND account_id = $2 AND id NOT IN (sqlc.slice('keep'));

-- name: ClearTradeExecutions :exec
DELETE FROM trade_executions WHERE trade_id = $1;

-- name: ListExecutionsForTrade :many
SELECT e.* FROM executions e
JOIN trade_executions te ON te.execution_id = e.id
WHERE te.trade_id = $1 ORDER BY e.executed_at, e.id;
