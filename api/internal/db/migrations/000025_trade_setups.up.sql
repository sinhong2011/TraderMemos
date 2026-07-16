CREATE TABLE trade_setups (
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    setup_id TEXT NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, setup_id)
);

CREATE INDEX idx_trade_setups_setup ON trade_setups(setup_id);
