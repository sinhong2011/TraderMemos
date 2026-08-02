-- name: ListTradesMissingExcursion :many
-- Closed, chart-eligible trades with no recorded MFE, newest first. Options
-- are excluded up front: bars for OCC symbols chart the underlying, so auto
-- excursion would mislead (same rule as the excursion endpoint).
SELECT t.* FROM trades t
LEFT JOIN trade_journal j ON j.trade_id = t.id
WHERE t.status = 'closed' AND t.instrument_type != 'option'
  AND (j.trade_id IS NULL OR j.mfe IS NULL)
ORDER BY t.closed_at DESC
LIMIT $1;
