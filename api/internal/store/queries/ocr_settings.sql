-- name: GetOcrSettings :one
SELECT id, enabled, base_url, api_key, model, custom_prompt, updated_at
FROM ocr_settings
WHERE id = 1;

-- name: UpsertOcrSettings :one
INSERT INTO ocr_settings (id, enabled, base_url, api_key, model, custom_prompt, updated_at)
VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
    enabled = excluded.enabled,
    base_url = excluded.base_url,
    api_key = excluded.api_key,
    model = excluded.model,
    custom_prompt = excluded.custom_prompt,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
