-- name: GetMarketBarsCache :one
SELECT cache_key, symbol, interval, from_ts, to_ts, bars_json, provider, fetched_at, expires_at
FROM market_bars_cache
WHERE cache_key = $1;

-- name: UpsertMarketBarsCache :exec
INSERT INTO market_bars_cache (
    cache_key, symbol, interval, from_ts, to_ts, bars_json, provider, fetched_at, expires_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT(cache_key) DO UPDATE SET
    bars_json = excluded.bars_json,
    provider = excluded.provider,
    fetched_at = excluded.fetched_at,
    expires_at = excluded.expires_at;
