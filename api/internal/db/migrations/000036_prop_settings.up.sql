CREATE TABLE IF NOT EXISTS prop_settings (
    account_id       TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profit_target    REAL,
    max_drawdown     REAL,
    drawdown_mode    TEXT NOT NULL DEFAULT 'trailing',
    daily_loss_limit REAL,
    consistency_pct  REAL,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
