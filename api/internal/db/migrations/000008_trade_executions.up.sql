CREATE TABLE trade_executions (
    trade_id     TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, execution_id)
);
CREATE INDEX idx_te_execution ON trade_executions(execution_id);
