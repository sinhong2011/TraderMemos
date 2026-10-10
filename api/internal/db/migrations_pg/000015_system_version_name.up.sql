-- Optional human name for a system version ("Trend pullbacks"). The label
-- stays the version number (v1.1) that nextLabel bumps.
ALTER TABLE system_versions ADD COLUMN name TEXT NOT NULL DEFAULT '';
