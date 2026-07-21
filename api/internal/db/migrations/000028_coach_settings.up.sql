CREATE TABLE coach_settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    enabled       INTEGER NOT NULL DEFAULT 0,
    base_url      TEXT NOT NULL DEFAULT '',
    api_key       TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    custom_prompt TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
