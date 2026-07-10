-- name: CreateJournalNote :one
INSERT INTO journal_notes (id, user_id, occurred_at, title, body, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListJournalNotes :many
SELECT * FROM journal_notes
WHERE user_id = ?
  AND (sqlc.narg('from_date') IS NULL OR occurred_at >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date') IS NULL OR occurred_at <= sqlc.narg('to_date'))
ORDER BY occurred_at DESC, created_at DESC;

-- name: GetJournalNote :one
SELECT * FROM journal_notes WHERE id = ? AND user_id = ?;

-- name: UpdateJournalNote :one
UPDATE journal_notes
SET occurred_at = ?, title = ?, body = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: DeleteJournalNote :execrows
DELETE FROM journal_notes WHERE id = ? AND user_id = ?;

-- name: GetChecklistTemplate :one
SELECT * FROM checklist_templates WHERE user_id = ?;

-- name: UpsertChecklistTemplate :one
INSERT INTO checklist_templates (user_id, items, updated_at)
VALUES (?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    items = excluded.items,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
