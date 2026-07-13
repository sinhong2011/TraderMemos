-- name: GetTradeIDForExecution :one
SELECT trade_id FROM trade_executions WHERE execution_id = ? LIMIT 1;
