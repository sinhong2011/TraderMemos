-- Stop after this many losing closes in a row (null = unset). Appended to
-- keep the column order matching SQLite (store↔storepg struct conversions).
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS max_consecutive_losses INTEGER;
