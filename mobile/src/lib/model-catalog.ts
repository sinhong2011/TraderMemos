/**
 * Turns an OpenAI-compatible `/models` listing into something pickable.
 *
 * Gateways like new-api or OpenRouter list every model a key can reach — chat,
 * TTS, embeddings — with no capability metadata, so "can it read a
 * screenshot?" is guessed from the id. The guess is deliberately conservative
 * and only ever hides: a wrongly hidden model is one "Show all" tap away, while
 * a wrongly shown one is just a row that fails its scan.
 */

/** Ids that name a non-chat modality outright. */
const NON_VISION = /(tts|embed|whisper|audio|speech|transcri|rerank|moderation|dall-e|imagen|veo|sora|lyria)/i;
/** Families whose plain chat models are text-only… */
const TEXT_ONLY_FAMILY = /(deepseek|qwen|glm|kimi|minimax|mistral|mixtral|nemotron|llama)/i;
/** …unless the id marks the vision variant (`-vl`, `-vision`, `glm-4.5v`). */
const VISION_HINT = /(vision|vl|omni|pixtral|\d(\.\d+)?v\b)/i;

export function isLikelyVisionModel(id: string): boolean {
  if (NON_VISION.test(id)) return false;
  if (TEXT_ONLY_FAMILY.test(id) && !VISION_HINT.test(id)) return false;
  return true;
}

/** `deepseek-ai/deepseek-v4` → `deepseek-ai`; `gemini-3.6-flash` → `gemini`. */
export function modelGroup(id: string): string {
  const slash = id.indexOf('/');
  if (slash > 0) return id.slice(0, slash).toLowerCase();
  const word = /^[a-z]+/i.exec(id);
  return word ? word[0].toLowerCase() : id.toLowerCase();
}

/** The id without its `vendor/` prefix — the group header already says it. */
export function modelLabel(id: string): string {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(slash + 1) : id;
}

export type ModelGroup = { group: string; models: string[] };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Filters by a case-insensitive substring, then groups by vendor, both sorted. */
export function groupModels(ids: readonly string[], query: string): ModelGroup[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    if (needle && !id.toLowerCase().includes(needle)) continue;
    const key = modelGroup(id);
    const list = groups.get(key);
    if (list) list.push(id);
    else groups.set(key, [id]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => byName(a, b))
    .map(([group, models]) => ({ group, models: models.sort(byName) }));
}
