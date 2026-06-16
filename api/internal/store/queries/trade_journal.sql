-- name: UpsertTradeJournal :exec
INSERT INTO trade_journal (trade_id, user_id, notes, setup_id, initial_risk, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(trade_id) DO UPDATE SET
    notes = excluded.notes, setup_id = excluded.setup_id,
    initial_risk = excluded.initial_risk, updated_at = CURRENT_TIMESTAMP;

-- name: GetTradeJournal :one
SELECT * FROM trade_journal WHERE trade_id = ? AND user_id = ?;
