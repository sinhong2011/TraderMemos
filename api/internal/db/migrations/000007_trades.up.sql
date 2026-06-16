CREATE TABLE trades (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol            TEXT NOT NULL,
    instrument_type   TEXT NOT NULL,
    direction         TEXT NOT NULL,               -- long|short
    status            TEXT NOT NULL,               -- open|closed
    opened_at         TIMESTAMP NOT NULL,
    closed_at         TIMESTAMP,
    qty_opened        REAL NOT NULL,
    avg_entry_price   REAL NOT NULL,
    avg_exit_price    REAL,
    gross_pnl         REAL,
    fees_total        REAL NOT NULL DEFAULT 0,
    net_pnl           REAL,
    pnl_currency      TEXT NOT NULL DEFAULT 'USD',
    return_pct        REAL,
    r_multiple        REAL,
    time_in_trade_secs INTEGER,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trades_account_closed ON trades(user_id, account_id, closed_at);
CREATE INDEX idx_trades_symbol ON trades(user_id, symbol);
