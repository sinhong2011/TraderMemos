-- Daily-log symbol cards linked to a journal note (TradeZella-style day ↔ ticker notes).
ALTER TABLE journal_notes ADD COLUMN symbols TEXT NOT NULL DEFAULT '[]';

-- Rich markdown body for the daily checklist / rules template (TipTap).
ALTER TABLE checklist_templates ADD COLUMN content TEXT NOT NULL DEFAULT '';
