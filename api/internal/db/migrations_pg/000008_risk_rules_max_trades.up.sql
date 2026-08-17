-- Max closed trades in a calendar day (null = unset). Appended so the column
-- order keeps matching the SQLite schema (store↔storepg struct conversions).
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS max_trades_per_day INTEGER;
