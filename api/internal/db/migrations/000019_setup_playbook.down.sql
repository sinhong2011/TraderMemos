-- SQLite cannot DROP COLUMN in older versions; leave columns in place on down.
-- No-op down for additive columns.
SELECT 1;
