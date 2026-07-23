-- Note kinds: freeform note vs session daily log (checklist + symbol cards).
ALTER TABLE journal_notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'note';

-- Existing rows were created under the daily-log UI.
UPDATE journal_notes SET note_type = 'daily_log';
