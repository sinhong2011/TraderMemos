-- name: GetCoachSettings :one
SELECT id, enabled, base_url, api_key, model, custom_prompt, updated_at
FROM coach_settings
WHERE id = 1;

-- name: UpsertCoachSettings :one
INSERT INTO coach_settings (id, enabled, base_url, api_key, model, custom_prompt, updated_at)
VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
    enabled = excluded.enabled,
    base_url = excluded.base_url,
    api_key = excluded.api_key,
    model = excluded.model,
    custom_prompt = excluded.custom_prompt,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
