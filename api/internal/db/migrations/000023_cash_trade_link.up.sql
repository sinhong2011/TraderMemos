ALTER TABLE cash_transactions ADD COLUMN trade_id TEXT REFERENCES trades(id) ON DELETE SET NULL;
CREATE INDEX idx_cash_trade ON cash_transactions(trade_id);
