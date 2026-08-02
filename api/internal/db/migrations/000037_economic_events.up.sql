CREATE TABLE IF NOT EXISTS economic_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    provider   TEXT NOT NULL DEFAULT 'forexfactory',
    title      TEXT NOT NULL,
    country    TEXT NOT NULL,
    impact     TEXT NOT NULL,
    event_ts   TEXT NOT NULL,
    forecast   TEXT NOT NULL DEFAULT '',
    previous   TEXT NOT NULL DEFAULT '',
    actual     TEXT NOT NULL DEFAULT '',
    fetched_at TEXT NOT NULL,
    UNIQUE (provider, country, title, event_ts)
);

CREATE INDEX IF NOT EXISTS idx_economic_events_ts ON economic_events(event_ts);
