CREATE TABLE trade_journal (
    trade_id     TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes        TEXT NOT NULL DEFAULT '',
    setup_id     TEXT REFERENCES setups(id) ON DELETE SET NULL,
    initial_risk REAL,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trade_journal_user ON trade_journal(user_id);
CREATE INDEX idx_trade_journal_setup ON trade_journal(setup_id);
