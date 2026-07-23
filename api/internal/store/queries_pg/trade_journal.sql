-- name: UpsertTradeJournal :exec
INSERT INTO trade_journal (
    trade_id, user_id, notes, setup_id, initial_risk, target_price, stop_price,
    emotional_state, confidence, trade_quality, mae, mfe, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
ON CONFLICT(trade_id) DO UPDATE SET
    notes = excluded.notes,
    setup_id = excluded.setup_id,
    initial_risk = excluded.initial_risk,
    target_price = excluded.target_price,
    stop_price = excluded.stop_price,
    emotional_state = excluded.emotional_state,
    confidence = excluded.confidence,
    trade_quality = excluded.trade_quality,
    mae = excluded.mae,
    mfe = excluded.mfe,
    updated_at = CURRENT_TIMESTAMP;

-- name: GetTradeJournal :one
SELECT * FROM trade_journal WHERE trade_id = $1 AND user_id = $2;

-- name: ListTradeJournalsForUser :many
SELECT * FROM trade_journal WHERE user_id = $1;
