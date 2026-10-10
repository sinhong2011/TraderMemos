-- name: GetTradingSystemByUser :one
SELECT * FROM trading_systems WHERE user_id = ?;

-- name: CreateTradingSystem :one
INSERT INTO trading_systems (id, user_id, name)
VALUES (?, ?, ?)
RETURNING *;

-- name: ListSystemVersions :many
SELECT * FROM system_versions
WHERE user_id = ?
ORDER BY created_at ASC, id ASC;

-- name: GetSystemVersion :one
SELECT * FROM system_versions WHERE id = ? AND user_id = ?;

-- name: GetActiveSystemVersion :one
SELECT * FROM system_versions
WHERE user_id = ? AND status = 'active'
LIMIT 1;

-- name: GetDraftSystemVersion :one
SELECT * FROM system_versions
WHERE user_id = ? AND status = 'draft'
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateSystemVersion :one
INSERT INTO system_versions (
    id, system_id, user_id, label, status, rules, open_questions, regimes, trade_types
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: UpdateSystemVersion :one
UPDATE system_versions
SET label = ?, rules = ?, open_questions = ?, regimes = ?, trade_types = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND status = 'draft'
RETURNING *;

-- name: ActivateSystemVersion :one
UPDATE system_versions
SET status = 'active', activated_at = ?, retired_at = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: RetireSystemVersion :execrows
UPDATE system_versions
SET status = 'retired', retired_at = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND status = 'active';

-- name: DeleteSystemVersion :execrows
DELETE FROM system_versions WHERE id = ? AND user_id = ? AND status = 'draft';

-- name: ListSystemChanges :many
SELECT * FROM system_changes
WHERE user_id = ?
ORDER BY created_at DESC, id DESC;

-- name: ListSystemChangesForVersion :many
SELECT * FROM system_changes
WHERE version_id = ? AND user_id = ?
ORDER BY created_at ASC, id ASC;

-- name: CreateSystemChange :one
INSERT INTO system_changes (id, version_id, user_id, decision, reason, note, evidence_trade_ids)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: GetMarketRegimeDay :one
SELECT * FROM market_regime_days WHERE user_id = ? AND day = ?;

-- name: UpsertMarketRegimeDay :one
INSERT INTO market_regime_days (user_id, day, regime, note)
VALUES (?, ?, ?, ?)
ON CONFLICT (user_id, day) DO UPDATE SET
    regime = excluded.regime,
    note = excluded.note
RETURNING *;

-- name: DeleteMarketRegimeDay :execrows
DELETE FROM market_regime_days WHERE user_id = ? AND day = ?;

-- name: ListAllMarketRegimeDays :many
SELECT * FROM market_regime_days WHERE user_id = ? ORDER BY day DESC;

-- name: GetTradeSystemCard :one
SELECT * FROM trade_system_cards WHERE trade_id = ? AND user_id = ?;

-- name: ListTradeSystemCards :many
SELECT * FROM trade_system_cards WHERE user_id = ?;

-- name: UpsertTradeSystemCard :one
INSERT INTO trade_system_cards (
    trade_id, user_id, version_id, regime, trigger_met, trade_type, thesis,
    planned_hold_days, time_stop_days, exit_state, adherence, checklist,
    lesson, rule_change, planned_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (trade_id) DO UPDATE SET
    version_id = excluded.version_id,
    regime = excluded.regime,
    trigger_met = excluded.trigger_met,
    trade_type = excluded.trade_type,
    thesis = excluded.thesis,
    planned_hold_days = excluded.planned_hold_days,
    time_stop_days = excluded.time_stop_days,
    exit_state = excluded.exit_state,
    adherence = excluded.adherence,
    checklist = excluded.checklist,
    lesson = excluded.lesson,
    rule_change = excluded.rule_change,
    planned_at = excluded.planned_at,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
