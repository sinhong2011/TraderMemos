-- name: SetTradeSetup :exec
INSERT INTO trade_setups (trade_id, setup_id) VALUES ($1, $2)
ON CONFLICT (trade_id, setup_id) DO NOTHING;

-- name: ClearTradeSetups :exec
DELETE FROM trade_setups WHERE trade_id = $1;

-- name: ListSetupsForTrade :many
SELECT s.* FROM setups s
JOIN trade_setups ts ON ts.setup_id = s.id
WHERE ts.trade_id = $1
ORDER BY s.name;
