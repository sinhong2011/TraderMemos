-- Evidence recorded while a linked plan is held (Postgres). See SQLite 000052.

CREATE TABLE IF NOT EXISTS system_plan_evidence (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES system_plans(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    withdrawn_at    TIMESTAMPTZ,
    withdraw_reason TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_plan_evidence_plan ON system_plan_evidence(plan_id, created_at);

CREATE TABLE IF NOT EXISTS system_plan_evidence_revisions (
    id           TEXT PRIMARY KEY,
    evidence_id  TEXT NOT NULL REFERENCES system_plan_evidence(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seq          BIGINT NOT NULL,
    decision_id  TEXT NOT NULL,
    stance       TEXT NOT NULL,
    body         TEXT NOT NULL DEFAULT '',
    state        TEXT NOT NULL,
    action       TEXT NOT NULL,
    source       TEXT NOT NULL DEFAULT 'live',
    occurred_at  TIMESTAMPTZ,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_plan_evidence_rev_seq
    ON system_plan_evidence_revisions(evidence_id, seq);
