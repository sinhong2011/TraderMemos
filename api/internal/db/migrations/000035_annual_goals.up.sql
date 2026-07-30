CREATE TABLE annual_goals (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year       INTEGER NOT NULL,
    amount     REAL NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, year)
);
