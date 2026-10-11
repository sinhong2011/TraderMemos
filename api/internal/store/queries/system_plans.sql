-- name: CreateSystemPlan :one
INSERT INTO system_plans (id, user_id, version_id, symbol, direction, status, source)
VALUES (?, ?, ?, ?, ?, 'planned', ?)
RETURNING *;

-- name: GetSystemPlan :one
SELECT * FROM system_plans WHERE id = ? AND user_id = ?;

-- name: ListSystemPlans :many
SELECT * FROM system_plans
WHERE user_id = ?
ORDER BY created_at DESC, id DESC;

-- name: GetSystemPlanByTrade :one
SELECT * FROM system_plans WHERE trade_id = ? AND user_id = ? LIMIT 1;

-- name: UpdateSystemPlanStatus :one
UPDATE system_plans
SET status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: SetSystemPlanTrade :one
UPDATE system_plans
SET trade_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: TouchSystemPlan :exec
UPDATE system_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?;

-- name: CreateSystemPlanRevision :one
INSERT INTO system_plan_revisions (
    id, plan_id, user_id, seq, stage, setup, thesis, trigger_text, invalidation,
    entry_price, stop_price, target_price, conditions, occurred_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListSystemPlanRevisions :many
SELECT * FROM system_plan_revisions
WHERE plan_id = ? AND user_id = ?
ORDER BY seq ASC;

-- name: ListLatestSystemPlanRevisions :many
SELECT r.* FROM system_plan_revisions r
WHERE r.user_id = ? AND r.seq = (
    SELECT MAX(s.seq) FROM system_plan_revisions s WHERE s.plan_id = r.plan_id
);

-- name: MaxSystemPlanRevisionSeq :one
SELECT CAST(COALESCE(MAX(seq), 0) AS INTEGER) FROM system_plan_revisions WHERE plan_id = ? AND user_id = ?;

-- name: CreateSystemPlanEvent :one
INSERT INTO system_plan_events (id, plan_id, user_id, kind, from_status, to_status, trade_id, reason)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListSystemPlanEvents :many
SELECT * FROM system_plan_events
WHERE plan_id = ? AND user_id = ?
ORDER BY created_at ASC, id ASC;

-- name: ListTradesBySymbol :many
SELECT * FROM trades
WHERE user_id = ? AND symbol = ?
ORDER BY opened_at DESC
LIMIT 50;
