-- name: CreateTag :one
INSERT INTO tags (id, user_id, name, color, description, kind) VALUES (?, ?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateTag :execrows
UPDATE tags SET name = ?, color = ?, description = ?, kind = ? WHERE id = ? AND user_id = ?;

-- name: ListTags :many
SELECT * FROM tags WHERE user_id = ? ORDER BY name;

-- name: DeleteTag :execrows
DELETE FROM tags WHERE id = ? AND user_id = ?;

-- name: SetTradeTags :exec
INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?);

-- name: ClearTradeTags :exec
DELETE FROM trade_tags WHERE trade_id = ?;

-- name: ListTagsForTrade :many
SELECT t.* FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = ?;

-- name: ListTradeTagsForUser :many
SELECT tt.trade_id, t.id, t.user_id, t.name, t.color, t.description, t.kind
FROM trade_tags tt
JOIN tags t ON t.id = tt.tag_id
JOIN trades tr ON tr.id = tt.trade_id
WHERE tr.user_id = ?
ORDER BY t.name;
