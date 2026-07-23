-- name: GetTradeIDForExecution :one
SELECT trade_id FROM trade_executions WHERE execution_id = $1 LIMIT 1;
