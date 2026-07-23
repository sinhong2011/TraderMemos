-- name: CreateTag :one
INSERT INTO tags (id, user_id, name, color, description, kind) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: UpdateTag :execrows
UPDATE tags SET name = $1, color = $2, description = $3, kind = $4 WHERE id = $5 AND user_id = $6;

-- name: ListTags :many
SELECT * FROM tags WHERE user_id = $1 ORDER BY name;

-- name: DeleteTag :execrows
DELETE FROM tags WHERE id = $1 AND user_id = $2;

-- name: SetTradeTags :exec
INSERT INTO trade_tags (trade_id, tag_id) VALUES ($1, $2)
ON CONFLICT (trade_id, tag_id) DO NOTHING;

-- name: ClearTradeTags :exec
DELETE FROM trade_tags WHERE trade_id = $1;

-- name: ListTagsForTrade :many
SELECT t.* FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = $1;

-- name: ListTradeTagsForUser :many
SELECT tt.trade_id, t.id, t.user_id, t.name, t.color, t.description, t.kind
FROM trade_tags tt
JOIN tags t ON t.id = tt.tag_id
JOIN trades tr ON tr.id = tt.trade_id
WHERE tr.user_id = $1
ORDER BY t.name;
