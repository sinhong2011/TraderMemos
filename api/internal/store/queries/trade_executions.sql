-- name: GetTradeIDForExecution :one
SELECT trade_id FROM trade_executions WHERE execution_id = ? LIMIT 1;

-- name: ListOptionExecutionDetailsForUser :many
SELECT te.trade_id, e.symbol, e.details
FROM trade_executions te
JOIN executions e ON e.id = te.execution_id
JOIN trades t ON t.id = te.trade_id
WHERE t.user_id = ? AND t.instrument_type = 'option'
ORDER BY e.executed_at;
