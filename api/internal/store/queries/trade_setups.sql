-- name: SetTradeSetup :exec
INSERT OR IGNORE INTO trade_setups (trade_id, setup_id) VALUES (?, ?);

-- name: ClearTradeSetups :exec
DELETE FROM trade_setups WHERE trade_id = ?;

-- name: ListSetupsForTrade :many
SELECT s.* FROM setups s
JOIN trade_setups ts ON ts.setup_id = s.id
WHERE ts.trade_id = ?
ORDER BY s.name;
