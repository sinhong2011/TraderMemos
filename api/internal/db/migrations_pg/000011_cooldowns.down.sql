DROP TABLE IF EXISTS cooldown_sessions;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS cooldown_minutes;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS cooldown_enabled;
