-- Routines: the daily checklist grown into staged, scheduled items with a
-- per-day record of what was done.
--
-- start_day / end_day are the person's local calendar days (YYYY-MM-DD) sent by
-- the client, not timestamps: "was this item on today's list" is a wall-clock
-- question, and deriving it from a UTC created_at would move items across
-- midnight for anyone east or west of Greenwich. Archiving sets end_day rather
-- than deleting, so retiring an item never rewrites the days it was on.
--
-- weekdays is a bitmask, Sunday = 1 << 0 ... Saturday = 1 << 6 (Go's
-- time.Weekday order); 62 = Monday to Friday.
CREATE TABLE IF NOT EXISTS routine_items (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    stage      TEXT NOT NULL DEFAULT 'pre',
    weekdays   INTEGER NOT NULL DEFAULT 62,
    position   INTEGER NOT NULL DEFAULT 0,
    start_day  TEXT NOT NULL,
    end_day    TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_routine_items_user ON routine_items(user_id, position);

-- A row means the item was done on that day; unticking deletes it.
CREATE TABLE IF NOT EXISTS routine_checks (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id    TEXT NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
    day        TEXT NOT NULL,
    checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id, day)
);
CREATE INDEX IF NOT EXISTS idx_routine_checks_user_day ON routine_checks(user_id, day);
