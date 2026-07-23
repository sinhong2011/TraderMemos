-- name: SetTradeSetup :exec
INSERT INTO trade_setups (trade_id, setup_id) VALUES (?, ?)
ON CONFLICT (trade_id, setup_id) DO NOTHING;

-- name: ClearTradeSetups :exec
DELETE FROM trade_setups WHERE trade_id = ?;

-- name: ListSetupsForTrade :many
SELECT s.* FROM setups s
JOIN trade_setups ts ON ts.setup_id = s.id
WHERE ts.trade_id = ?
ORDER BY s.name;
