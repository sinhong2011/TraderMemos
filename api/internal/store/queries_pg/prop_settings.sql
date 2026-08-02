-- name: GetPropSettings :one
SELECT account_id, user_id, profit_target, max_drawdown, drawdown_mode, daily_loss_limit, consistency_pct, updated_at
FROM prop_settings WHERE account_id = $1 AND user_id = $2;

-- name: UpsertPropSettings :one
INSERT INTO prop_settings (account_id, user_id, profit_target, max_drawdown, drawdown_mode, daily_loss_limit, consistency_pct, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
ON CONFLICT(account_id) DO UPDATE SET
    profit_target = excluded.profit_target,
    max_drawdown = excluded.max_drawdown,
    drawdown_mode = excluded.drawdown_mode,
    daily_loss_limit = excluded.daily_loss_limit,
    consistency_pct = excluded.consistency_pct,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeletePropSettings :exec
DELETE FROM prop_settings WHERE account_id = $1 AND user_id = $2;
