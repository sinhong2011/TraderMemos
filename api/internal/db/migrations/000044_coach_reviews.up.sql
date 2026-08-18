-- Coach reviews: every LLM review the coach has produced for a trade.
--
-- Reviews are kept rather than regenerated so a trade page can show its last
-- review without spending another model call, and so future coaching can cite
-- what was already said ("last week I flagged you for moving stops").
--
-- notes is the JSON array the model returned, stored whole: the note shape is
-- the LLM response contract, is always read as a unit, and is never filtered
-- by field — the same reason trade_journal.checklist is JSON.
CREATE TABLE IF NOT EXISTS coach_reviews (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id    TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    model       TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '[]',
    next_action TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_trade ON coach_reviews(user_id, trade_id, created_at);
