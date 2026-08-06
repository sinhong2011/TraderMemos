-- Client preferences that belong to the account rather than to a device:
-- market timezone, display timezone, clock format, trade date basis, display
-- currency, screenshots cap. Sign in on a second device and the journal
-- reports the same numbers, because the market timezone alone decides which
-- calendar day a trade lands on.
--
-- One JSON blob, not a column per preference. The server never reads inside
-- it — clients own the shape, and every new toggle would otherwise be a
-- migration on two dialects. Merging is per key (see UpsertUserPreferences),
-- so two devices editing different preferences do not clobber each other.
--
-- Device-context preferences deliberately stay out: light/dark follows the
-- device it is on, and privacy mode follows the room you are in.
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefs      TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
