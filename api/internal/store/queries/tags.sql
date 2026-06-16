-- name: CreateTag :one
INSERT INTO tags (id, user_id, name, color, description) VALUES (?, ?, ?, ?, ?) RETURNING *;

-- name: ListTags :many
SELECT * FROM tags WHERE user_id = ? ORDER BY name;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = ? AND user_id = ?;

-- name: SetTradeTags :exec
INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?);

-- name: ClearTradeTags :exec
DELETE FROM trade_tags WHERE trade_id = ?;

-- name: ListTagsForTrade :many
SELECT t.* FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = ?;
