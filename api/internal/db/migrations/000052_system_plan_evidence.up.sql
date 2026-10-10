-- Evidence recorded while a linked plan is held. The row is the note;
-- its content lives in append-only revisions so a correction never
-- overwrites what was written first. Withdrawing sets a timestamp and
-- reason and leaves the revisions in place. New tables only.

CREATE TABLE IF NOT EXISTS system_plan_evidence (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES system_plans(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    withdrawn_at    TIMESTAMP,
    withdraw_reason TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_plan_evidence_plan ON system_plan_evidence(plan_id, created_at);

CREATE TABLE IF NOT EXISTS system_plan_evidence_revisions (
    id           TEXT PRIMARY KEY,
    evidence_id  TEXT NOT NULL REFERENCES system_plan_evidence(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seq          INTEGER NOT NULL,
    decision_id  TEXT NOT NULL,
    stance       TEXT NOT NULL, -- support | weaken | uncertain
    body         TEXT NOT NULL DEFAULT '',
    state        TEXT NOT NULL, -- wrong | still_working | not_working | finished
    action       TEXT NOT NULL, -- hold | add | trim | take_profit | exit
    source       TEXT NOT NULL DEFAULT 'live', -- live | retrospective
    occurred_at  TIMESTAMP,
    recorded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_plan_evidence_rev_seq
    ON system_plan_evidence_revisions(evidence_id, seq);
