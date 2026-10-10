-- name: CreateSystemPlan :one
INSERT INTO system_plans (id, user_id, version_id, symbol, direction, status, source)
VALUES ($1, $2, $3, $4, $5, 'planned', $6)
RETURNING *;

-- name: GetSystemPlan :one
SELECT * FROM system_plans WHERE id = $1 AND user_id = $2;

-- name: ListSystemPlans :many
SELECT * FROM system_plans
WHERE user_id = $1
ORDER BY created_at DESC, id DESC;

-- name: GetSystemPlanByTrade :one
SELECT * FROM system_plans WHERE trade_id = $1 AND user_id = $2 LIMIT 1;

-- name: UpdateSystemPlanStatus :one
UPDATE system_plans
SET status = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: SetSystemPlanTrade :one
UPDATE system_plans
SET trade_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $3 AND user_id = $4
RETURNING *;

-- name: TouchSystemPlan :exec
UPDATE system_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2;

-- name: CreateSystemPlanRevision :one
INSERT INTO system_plan_revisions (
    id, plan_id, user_id, seq, stage, setup, thesis, trigger_text, invalidation,
    entry_price, stop_price, target_price, conditions, occurred_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: ListSystemPlanRevisions :many
SELECT * FROM system_plan_revisions
WHERE plan_id = $1 AND user_id = $2
ORDER BY seq ASC;

-- name: ListLatestSystemPlanRevisions :many
SELECT r.* FROM system_plan_revisions r
WHERE r.user_id = $1 AND r.seq = (
    SELECT MAX(s.seq) FROM system_plan_revisions s WHERE s.plan_id = r.plan_id
);

-- name: MaxSystemPlanRevisionSeq :one
SELECT CAST(COALESCE(MAX(seq), 0) AS BIGINT) FROM system_plan_revisions WHERE plan_id = $1 AND user_id = $2;

-- name: CreateSystemPlanEvent :one
INSERT INTO system_plan_events (id, plan_id, user_id, kind, from_status, to_status, trade_id, reason)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListSystemPlanEvents :many
SELECT * FROM system_plan_events
WHERE plan_id = $1 AND user_id = $2
ORDER BY created_at ASC, id ASC;

-- name: ListTradesBySymbol :many
SELECT * FROM trades
WHERE user_id = $1 AND symbol = $2
ORDER BY opened_at DESC
LIMIT 50;
