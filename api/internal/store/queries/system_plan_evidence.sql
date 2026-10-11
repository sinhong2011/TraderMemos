-- name: CreateSystemPlanEvidence :one
INSERT INTO system_plan_evidence (id, plan_id, user_id)
VALUES (?, ?, ?)
RETURNING *;

-- name: GetSystemPlanEvidence :one
SELECT * FROM system_plan_evidence WHERE id = ? AND user_id = ?;

-- name: ListSystemPlanEvidence :many
SELECT * FROM system_plan_evidence
WHERE plan_id = ? AND user_id = ?
ORDER BY created_at DESC, id DESC;

-- name: WithdrawSystemPlanEvidence :one
UPDATE system_plan_evidence
SET withdrawn_at = CURRENT_TIMESTAMP, withdraw_reason = ?
WHERE id = ? AND user_id = ? AND withdrawn_at IS NULL
RETURNING *;

-- name: CreateSystemPlanEvidenceRevision :one
INSERT INTO system_plan_evidence_revisions (
    id, evidence_id, user_id, seq, decision_id, stance, body, state, action, source, occurred_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListSystemPlanEvidenceRevisions :many
SELECT r.id, r.evidence_id, r.user_id, r.seq, r.decision_id, r.stance, r.body, r.state, r.action, r.source, r.occurred_at, r.recorded_at
FROM system_plan_evidence_revisions r
INNER JOIN system_plan_evidence e ON e.id = r.evidence_id
WHERE e.plan_id = ? AND e.user_id = ?
ORDER BY r.seq ASC, r.recorded_at ASC;

-- name: MaxSystemPlanEvidenceRevisionSeq :one
SELECT CAST(COALESCE(MAX(seq), 0) AS INTEGER)
FROM system_plan_evidence_revisions
WHERE evidence_id = ? AND user_id = ?;
