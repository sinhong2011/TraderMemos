-- name: CreateJournalNote :one
INSERT INTO journal_notes (id, user_id, occurred_at, title, body, symbols, note_type, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListJournalNotes :many
SELECT * FROM journal_notes
WHERE user_id = $1
  AND (sqlc.narg('from_date') IS NULL OR occurred_at >= sqlc.narg('from_date'))
  AND (sqlc.narg('to_date') IS NULL OR occurred_at <= sqlc.narg('to_date'))
ORDER BY occurred_at DESC, created_at DESC;

-- name: GetJournalNote :one
SELECT * FROM journal_notes WHERE id = $1 AND user_id = $2;

-- name: UpdateJournalNote :one
UPDATE journal_notes
SET occurred_at = $1, title = $2, body = $3, symbols = $4, note_type = $5, updated_at = CURRENT_TIMESTAMP
WHERE id = $6 AND user_id = $7
RETURNING *;

-- name: DeleteJournalNote :execrows
DELETE FROM journal_notes WHERE id = $1 AND user_id = $2;

-- name: GetChecklistTemplate :one
SELECT * FROM checklist_templates WHERE user_id = $1;

-- name: UpsertChecklistTemplate :one
INSERT INTO checklist_templates (user_id, items, content, updated_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
    items = excluded.items,
    content = excluded.content,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
