-- name: UpsertEconomicEvent :exec
INSERT INTO economic_events (
    provider, title, country, impact, event_ts, forecast, previous, actual, fetched_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(provider, country, title, event_ts) DO UPDATE SET
    impact = excluded.impact,
    forecast = excluded.forecast,
    previous = excluded.previous,
    actual = excluded.actual,
    fetched_at = excluded.fetched_at;

-- name: ListEconomicEvents :many
SELECT id, provider, title, country, impact, event_ts, forecast, previous, actual, fetched_at
FROM economic_events
WHERE event_ts >= ?1 AND event_ts < ?2
ORDER BY event_ts, country, title;

-- name: DeleteFutureEconomicEvents :exec
DELETE FROM economic_events
WHERE provider = ?1 AND event_ts >= ?2;

-- name: GetEconomicEventsLastFetch :one
SELECT fetched_at
FROM economic_events
WHERE provider = ?1
ORDER BY fetched_at DESC
LIMIT 1;
