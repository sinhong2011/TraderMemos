CREATE TABLE trade_tags (
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);
