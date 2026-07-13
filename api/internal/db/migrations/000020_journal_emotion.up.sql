ALTER TABLE trade_journal ADD COLUMN emotional_state TEXT NOT NULL DEFAULT '';
ALTER TABLE trade_journal ADD COLUMN confidence INTEGER;
ALTER TABLE trade_journal ADD COLUMN trade_quality INTEGER;
