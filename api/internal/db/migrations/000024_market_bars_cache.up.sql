CREATE TABLE market_bars_cache (
    cache_key   TEXT PRIMARY KEY,
    symbol      TEXT NOT NULL,
    interval    TEXT NOT NULL,
    from_ts     TEXT NOT NULL,
    to_ts       TEXT NOT NULL,
    bars_json   BLOB NOT NULL,
    provider    TEXT NOT NULL,
    fetched_at  TEXT NOT NULL,
    expires_at  TEXT
);

CREATE INDEX idx_market_bars_cache_lookup
    ON market_bars_cache(symbol, interval, from_ts, to_ts);
