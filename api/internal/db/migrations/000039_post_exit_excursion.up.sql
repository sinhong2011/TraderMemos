-- Add post_exit_mae / post_exit_mfe via table rebuild: SQLite has no
-- ADD COLUMN IF NOT EXISTS, and dirty-recovery re-runs the newest migration,
-- so a bare ALTER would fail with "duplicate column" (see migrate.go).
DROP TABLE IF EXISTS trade_journal_rebuild;
CREATE TABLE trade_journal_rebuild (
    trade_id        TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes           TEXT NOT NULL DEFAULT '',
    setup_id        TEXT REFERENCES setups(id) ON DELETE SET NULL,
    initial_risk    REAL,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    target_price    REAL,
    stop_price      REAL,
    emotional_state TEXT NOT NULL DEFAULT '',
    confidence      INTEGER,
    trade_quality   INTEGER,
    mae             REAL,
    mfe             REAL,
    post_exit_mae   REAL,
    post_exit_mfe   REAL
);
INSERT INTO trade_journal_rebuild (
    trade_id, user_id, notes, setup_id, initial_risk, updated_at,
    target_price, stop_price, emotional_state, confidence, trade_quality, mae, mfe
)
SELECT trade_id, user_id, notes, setup_id, initial_risk, updated_at,
       target_price, stop_price, emotional_state, confidence, trade_quality, mae, mfe
FROM trade_journal;
DROP TABLE trade_journal;
ALTER TABLE trade_journal_rebuild RENAME TO trade_journal;
CREATE INDEX IF NOT EXISTS idx_trade_journal_user ON trade_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_journal_setup ON trade_journal(setup_id);
