-- name: GetPropSettings :one
SELECT account_id, user_id, profit_target, max_drawdown, drawdown_mode, daily_loss_limit, consistency_pct, updated_at
FROM prop_settings WHERE account_id = ? AND user_id = ?;

-- name: UpsertPropSettings :one
INSERT INTO prop_settings (account_id, user_id, profit_target, max_drawdown, drawdown_mode, daily_loss_limit, consistency_pct, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(account_id) DO UPDATE SET
    profit_target = excluded.profit_target,
    max_drawdown = excluded.max_drawdown,
    drawdown_mode = excluded.drawdown_mode,
    daily_loss_limit = excluded.daily_loss_limit,
    consistency_pct = excluded.consistency_pct,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: DeletePropSettings :exec
DELETE FROM prop_settings WHERE account_id = ? AND user_id = ?;

-- name: ListPropSettingsForUser :many
SELECT account_id, user_id, profit_target, max_drawdown, drawdown_mode, daily_loss_limit, consistency_pct, updated_at
FROM prop_settings WHERE user_id = ? ORDER BY account_id;
