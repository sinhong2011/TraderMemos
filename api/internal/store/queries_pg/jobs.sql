-- name: ListTradesMissingExcursion :many
-- Closed, chart-eligible trades with no recorded MFE -- or with MFE but no
-- post-exit excursion yet -- newest first. Options are excluded up front: bars
-- for OCC symbols chart the underlying, so auto excursion would mislead (same
-- rule as the excursion endpoint). The post-exit arm waits until the window
-- has plausibly traded (post_cutoff ~= now-1h) and gives up on trades older
-- than post_floor, so the queue converges instead of retrying bar-less
-- symbols forever.
SELECT t.* FROM trades t
LEFT JOIN trade_journal j ON j.trade_id = t.id
WHERE t.status = 'closed' AND t.instrument_type != 'option'
  AND (j.trade_id IS NULL OR j.mfe IS NULL
       OR (j.post_exit_mfe IS NULL
           AND t.closed_at <= sqlc.arg(post_cutoff)
           AND t.closed_at >= sqlc.arg(post_floor)))
ORDER BY t.closed_at DESC
LIMIT sqlc.arg(row_limit);
