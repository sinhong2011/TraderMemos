-- Trade plans (Postgres). New tables only — see SQLite 000051.

CREATE TABLE IF NOT EXISTS system_plans (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version_id TEXT REFERENCES system_versions(id) ON DELETE SET NULL,
    symbol     TEXT NOT NULL,
    direction  TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'planned',
    source     TEXT NOT NULL DEFAULT 'live',
    trade_id   TEXT REFERENCES trades(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_plans_user ON system_plans(user_id, created_at);
-- A trade confirms at most one plan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_plans_trade ON system_plans(trade_id) WHERE trade_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS system_plan_revisions (
    id           TEXT PRIMARY KEY,
    plan_id      TEXT NOT NULL REFERENCES system_plans(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seq          BIGINT NOT NULL,
    stage        TEXT NOT NULL DEFAULT 'before_fill',
    setup        TEXT NOT NULL DEFAULT '',
    thesis       TEXT NOT NULL DEFAULT '',
    trigger_text TEXT NOT NULL DEFAULT '',
    invalidation TEXT NOT NULL DEFAULT '',
    entry_price  DOUBLE PRECISION,
    stop_price   DOUBLE PRECISION,
    target_price DOUBLE PRECISION,
    conditions   TEXT NOT NULL DEFAULT '{}',
    occurred_at  TIMESTAMPTZ,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_plan_revisions_seq ON system_plan_revisions(plan_id, seq);

CREATE TABLE IF NOT EXISTS system_plan_events (
    id          TEXT PRIMARY KEY,
    plan_id     TEXT NOT NULL REFERENCES system_plans(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    from_status TEXT NOT NULL DEFAULT '',
    to_status   TEXT NOT NULL DEFAULT '',
    trade_id    TEXT NOT NULL DEFAULT '',
    reason      TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_plan_events_plan ON system_plan_events(plan_id, created_at);
