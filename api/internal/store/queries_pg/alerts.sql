-- name: GetAlertSettings :one
SELECT * FROM alert_settings WHERE user_id = $1;

-- name: UpsertAlertSettings :one
INSERT INTO alert_settings (
    user_id, enabled, timezone,
    rule_risk, rule_daily_loss, rule_loss_streak, loss_streak_n,
    rule_prop_drawdown, prop_warn_pct, rule_unreviewed, unreviewed_days,
    updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    enabled = excluded.enabled,
    timezone = excluded.timezone,
    rule_risk = excluded.rule_risk,
    rule_daily_loss = excluded.rule_daily_loss,
    rule_loss_streak = excluded.rule_loss_streak,
    loss_streak_n = excluded.loss_streak_n,
    rule_prop_drawdown = excluded.rule_prop_drawdown,
    prop_warn_pct = excluded.prop_warn_pct,
    rule_unreviewed = excluded.rule_unreviewed,
    unreviewed_days = excluded.unreviewed_days,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: ListEnabledAlertSettings :many
SELECT * FROM alert_settings WHERE enabled = 1 ORDER BY user_id;

-- name: ListAlertChannels :many
SELECT * FROM alert_channels WHERE user_id = $1 ORDER BY created_at;

-- name: ListEnabledAlertChannels :many
SELECT * FROM alert_channels WHERE user_id = $1 AND enabled = 1 ORDER BY created_at;

-- name: GetAlertChannel :one
SELECT * FROM alert_channels WHERE id = $1 AND user_id = $2;

-- name: UpsertAlertChannel :one
INSERT INTO alert_channels (id, user_id, kind, target, label, enabled)
VALUES ($1, $2, $3, $4, $5, 1)
ON CONFLICT(user_id, kind, target) DO UPDATE SET
    label = excluded.label,
    enabled = 1,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: SetAlertChannelEnabled :one
UPDATE alert_channels SET enabled = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: DeleteAlertChannel :execrows
DELETE FROM alert_channels WHERE id = $1 AND user_id = $2;

-- name: UpdateAlertChannelStatus :exec
UPDATE alert_channels SET last_sent_at = $1, last_status = $2, last_error = $3
WHERE id = $4;

-- name: DisableAlertChannel :exec
UPDATE alert_channels SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1;

-- name: InsertAlertEvent :execrows
INSERT INTO alert_events (id, user_id, rule, dedupe_key, title, body, fired_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, rule, dedupe_key) DO NOTHING;

-- name: ListAlertEvents :many
SELECT * FROM alert_events WHERE user_id = $1 ORDER BY fired_at DESC LIMIT $2;

-- name: DeleteAlertChannelByTarget :execrows
DELETE FROM alert_channels WHERE user_id = $1 AND kind = $2 AND target = $3;
