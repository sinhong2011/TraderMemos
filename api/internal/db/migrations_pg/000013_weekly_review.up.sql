-- Weekly review: a Saturday push that opens a prefilled review note.
-- See the SQLite twin (000049_weekly_review) for the reasoning.
ALTER TABLE alert_settings ADD COLUMN IF NOT EXISTS rule_weekly_review INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS weekly_reviews (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    note_id    TEXT NOT NULL DEFAULT '',
    sent_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, week_start)
);
