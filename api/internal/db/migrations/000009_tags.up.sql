CREATE TABLE tags (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#CBD5E1',
    description TEXT NOT NULL DEFAULT '',
    UNIQUE(user_id, name)
);
