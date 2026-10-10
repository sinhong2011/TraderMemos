-- name: GetTradingSystemByUser :one
SELECT * FROM trading_systems WHERE user_id = $1;

-- name: CreateTradingSystem :one
INSERT INTO trading_systems (id, user_id, name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListSystemVersions :many
SELECT * FROM system_versions
WHERE user_id = $1
ORDER BY created_at ASC, id ASC;

-- name: GetSystemVersion :one
SELECT * FROM system_versions WHERE id = $1 AND user_id = $2;

-- name: GetActiveSystemVersion :one
SELECT * FROM system_versions
WHERE user_id = $1 AND status = 'active'
LIMIT 1;

-- name: GetDraftSystemVersion :one
SELECT * FROM system_versions
WHERE user_id = $1 AND status = 'draft'
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateSystemVersion :one
INSERT INTO system_versions (
    id, system_id, user_id, label, status, rules, open_questions, regimes, trade_types
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateSystemVersion :one
UPDATE system_versions
SET label = $1, rules = $2, open_questions = $3, regimes = $4, trade_types = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $6 AND user_id = $7 AND status = 'draft'
RETURNING *;

-- name: ActivateSystemVersion :one
UPDATE system_versions
SET status = 'active', activated_at = $1, retired_at = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3
RETURNING *;

-- name: RetireSystemVersion :execrows
UPDATE system_versions
SET status = 'retired', retired_at = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND user_id = $3 AND status = 'active';

-- name: DeleteSystemVersion :execrows
DELETE FROM system_versions WHERE id = $1 AND user_id = $2 AND status = 'draft';

-- name: ListSystemChanges :many
SELECT * FROM system_changes
WHERE user_id = $1
ORDER BY created_at DESC, id DESC;

-- name: ListSystemChangesForVersion :many
SELECT * FROM system_changes
WHERE version_id = $1 AND user_id = $2
ORDER BY created_at ASC, id ASC;

-- name: CreateSystemChange :one
INSERT INTO system_changes (id, version_id, user_id, decision, reason, note, evidence_trade_ids)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetMarketRegimeDay :one
SELECT * FROM market_regime_days WHERE user_id = $1 AND day = $2;

-- name: UpsertMarketRegimeDay :one
INSERT INTO market_regime_days (user_id, day, regime, note)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, day) DO UPDATE SET
    regime = EXCLUDED.regime,
    note = EXCLUDED.note
RETURNING *;

-- name: DeleteMarketRegimeDay :execrows
DELETE FROM market_regime_days WHERE user_id = $1 AND day = $2;

-- name: ListAllMarketRegimeDays :many
SELECT * FROM market_regime_days WHERE user_id = $1 ORDER BY day DESC;

-- name: GetTradeSystemCard :one
SELECT * FROM trade_system_cards WHERE trade_id = $1 AND user_id = $2;

-- name: ListTradeSystemCards :many
SELECT * FROM trade_system_cards WHERE user_id = $1;

-- name: UpsertTradeSystemCard :one
INSERT INTO trade_system_cards (
    trade_id, user_id, version_id, regime, trigger_met, trade_type, thesis,
    planned_hold_days, time_stop_days, exit_state, adherence, checklist,
    lesson, rule_change, planned_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT (trade_id) DO UPDATE SET
    version_id = EXCLUDED.version_id,
    regime = EXCLUDED.regime,
    trigger_met = EXCLUDED.trigger_met,
    trade_type = EXCLUDED.trade_type,
    thesis = EXCLUDED.thesis,
    planned_hold_days = EXCLUDED.planned_hold_days,
    time_stop_days = EXCLUDED.time_stop_days,
    exit_state = EXCLUDED.exit_state,
    adherence = EXCLUDED.adherence,
    checklist = EXCLUDED.checklist,
    lesson = EXCLUDED.lesson,
    rule_change = EXCLUDED.rule_change,
    planned_at = EXCLUDED.planned_at,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
