-- name: GetRiskRules :one
SELECT user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct, updated_at
FROM risk_rules WHERE user_id = ?;

-- name: UpsertRiskRules :one
INSERT INTO risk_rules (user_id, max_risk_per_trade, max_daily_loss, max_open_risk, default_account_risk_pct, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    max_risk_per_trade = excluded.max_risk_per_trade,
    max_daily_loss = excluded.max_daily_loss,
    max_open_risk = excluded.max_open_risk,
    default_account_risk_pct = excluded.default_account_risk_pct,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: ListJournalRisks :many
SELECT trade_id, initial_risk FROM trade_journal
WHERE user_id = ? AND initial_risk IS NOT NULL AND initial_risk > 0;
