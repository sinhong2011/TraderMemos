-- Squashed PostgreSQL schema (final shape of SQLite migrations 000001–000035).
-- Data backfills (opening deposit, note_type update) intentionally omitted.

CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret   TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_admin      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE accounts (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    broker           TEXT NOT NULL DEFAULT '',
    account_type     TEXT NOT NULL DEFAULT 'cash',
    base_currency    TEXT NOT NULL DEFAULT 'USD',
    starting_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TABLE instrument_specs (
    id              TEXT PRIMARY KEY,
    symbol_root     TEXT NOT NULL,
    instrument_type TEXT NOT NULL,
    tick_size       DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    tick_value      DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    multiplier      DOUBLE PRECISION NOT NULL DEFAULT 1,
    currency        TEXT NOT NULL DEFAULT 'USD',
    UNIQUE(symbol_root, instrument_type)
);

CREATE TABLE import_batches (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source         TEXT NOT NULL,
    filename       TEXT,
    column_mapping TEXT,
    row_count      INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_import_batches_user ON import_batches(user_id);

CREATE TABLE executions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id     TEXT,
    symbol          TEXT NOT NULL,
    instrument_type TEXT NOT NULL,
    side            TEXT NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL,
    price           DOUBLE PRECISION NOT NULL,
    fees            DOUBLE PRECISION NOT NULL DEFAULT 0,
    commission      DOUBLE PRECISION NOT NULL DEFAULT 0,
    executed_at     TIMESTAMP NOT NULL,
    multiplier      DOUBLE PRECISION NOT NULL DEFAULT 1,
    details         TEXT,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    dedup_hash      TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_exec_group ON executions(user_id, account_id, symbol, instrument_type, executed_at);
CREATE UNIQUE INDEX idx_exec_dedup ON executions(account_id, dedup_hash);

CREATE TABLE trades (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id         TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol             TEXT NOT NULL,
    instrument_type    TEXT NOT NULL,
    direction          TEXT NOT NULL,
    status             TEXT NOT NULL,
    opened_at          TIMESTAMP NOT NULL,
    closed_at          TIMESTAMP,
    qty_opened         DOUBLE PRECISION NOT NULL,
    avg_entry_price    DOUBLE PRECISION NOT NULL,
    avg_exit_price     DOUBLE PRECISION,
    gross_pnl          DOUBLE PRECISION,
    fees_total         DOUBLE PRECISION NOT NULL DEFAULT 0,
    net_pnl            DOUBLE PRECISION,
    pnl_currency       TEXT NOT NULL DEFAULT 'USD',
    return_pct         DOUBLE PRECISION,
    r_multiple         DOUBLE PRECISION,
    time_in_trade_secs INTEGER,
    notes              TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    qty_remaining      DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX idx_trades_account_closed ON trades(user_id, account_id, closed_at);
CREATE INDEX idx_trades_symbol ON trades(user_id, symbol);

CREATE TABLE trade_executions (
    trade_id     TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, execution_id)
);
CREATE INDEX idx_te_execution ON trade_executions(execution_id);

CREATE TABLE tags (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#CBD5E1',
    description TEXT NOT NULL DEFAULT '',
    kind        TEXT NOT NULL DEFAULT 'custom',
    UNIQUE(user_id, name)
);

CREATE TABLE trade_tags (
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);

CREATE TABLE cash_transactions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    amount          DOUBLE PRECISION NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    occurred_at     TIMESTAMP NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trade_id        TEXT REFERENCES trades(id) ON DELETE SET NULL
);
CREATE INDEX idx_cash_account ON cash_transactions(user_id, account_id, occurred_at);
CREATE INDEX idx_cash_trade ON cash_transactions(trade_id);

CREATE TABLE setups (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    thesis       TEXT NOT NULL DEFAULT '',
    symbol       TEXT NOT NULL DEFAULT '',
    direction    TEXT NOT NULL DEFAULT '',
    target_price DOUBLE PRECISION,
    stop_price   DOUBLE PRECISION,
    checklist    TEXT NOT NULL DEFAULT '[]',
    UNIQUE(user_id, name)
);
CREATE INDEX idx_setups_user ON setups(user_id);

CREATE TABLE trade_journal (
    trade_id         TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes            TEXT NOT NULL DEFAULT '',
    setup_id         TEXT REFERENCES setups(id) ON DELETE SET NULL,
    initial_risk     DOUBLE PRECISION,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    target_price     DOUBLE PRECISION,
    stop_price       DOUBLE PRECISION,
    emotional_state  TEXT NOT NULL DEFAULT '',
    confidence       INTEGER,
    trade_quality    INTEGER,
    mae              DOUBLE PRECISION,
    mfe              DOUBLE PRECISION
);
CREATE INDEX idx_trade_journal_user ON trade_journal(user_id);
CREATE INDEX idx_trade_journal_setup ON trade_journal(setup_id);

CREATE TABLE trade_attachments (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id     TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    storage_key  TEXT NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_attachments_trade ON trade_attachments(trade_id);

CREATE TABLE risk_rules (
    user_id                  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_risk_per_trade       DOUBLE PRECISION,
    max_daily_loss           DOUBLE PRECISION,
    max_open_risk            DOUBLE PRECISION,
    default_account_risk_pct DOUBLE PRECISION,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annual_goals (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year       INTEGER NOT NULL,
    amount     DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, year)
);

CREATE TABLE journal_notes (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    symbols     TEXT NOT NULL DEFAULT '[]',
    note_type   TEXT NOT NULL DEFAULT 'note'
);
CREATE INDEX idx_journal_notes_user_date ON journal_notes(user_id, occurred_at DESC);

CREATE TABLE checklist_templates (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    items      TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE market_bars_cache (
    cache_key  TEXT PRIMARY KEY,
    symbol     TEXT NOT NULL,
    interval   TEXT NOT NULL,
    from_ts    TEXT NOT NULL,
    to_ts      TEXT NOT NULL,
    bars_json  BYTEA NOT NULL,
    provider   TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    expires_at TEXT
);
CREATE INDEX idx_market_bars_cache_lookup
    ON market_bars_cache(symbol, interval, from_ts, to_ts);

CREATE TABLE trade_setups (
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    setup_id TEXT NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, setup_id)
);
CREATE INDEX idx_trade_setups_setup ON trade_setups(setup_id);

CREATE TABLE ocr_settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    enabled       INTEGER NOT NULL DEFAULT 0,
    base_url      TEXT NOT NULL DEFAULT '',
    api_key       TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    custom_prompt TEXT NOT NULL DEFAULT ''
);

CREATE TABLE coach_settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    enabled       INTEGER NOT NULL DEFAULT 0,
    base_url      TEXT NOT NULL DEFAULT '',
    api_key       TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    custom_prompt TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE access_tokens (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash   TEXT NOT NULL UNIQUE,
    expires_at   TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMP
);
CREATE INDEX idx_access_tokens_user ON access_tokens(user_id);
CREATE INDEX idx_access_tokens_hash ON access_tokens(token_hash);

CREATE TABLE media_files (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    storage_key  TEXT NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_media_files_user ON media_files(user_id);
