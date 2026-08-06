import type { Tag } from "@/lib/api/types";

/**
 * Starter vocabulary for the `mistake` tag kind.
 *
 * Mistake types are user-owned tags, so a fresh journal has none and the New
 * Trade form hides the picker entirely. These are offered as one-click adds in
 * Settings → Tags rather than seeded, so nobody inherits a taxonomy they did
 * not choose. Names match the wording already used by the seeded dev journal so
 * existing accounts dedupe cleanly instead of gaining near-duplicates.
 */
export const SUGGESTED_MISTAKE_TAGS: readonly string[] = [
  "Chased",
  "FOMO entry",
  "Late entry",
  "Oversized",
  "No plan",
  "No stop",
  "Moved stop",
  "Averaged down",
  "Revenge trade",
  "Overtrading",
  "Early exit",
  "Ignored plan",
];

/** Tag names collide on the server regardless of kind, so dedupe across all kinds. */
function normalizeTagName(name: string) {
  return name.trim().toLowerCase();
}

/** Suggestions the journal doesn't already have, in `SUGGESTED_MISTAKE_TAGS` order. */
export function missingMistakePresets(tags: readonly Pick<Tag, "name">[]): string[] {
  const taken = new Set(tags.map((tag) => normalizeTagName(tag.name)));
  return SUGGESTED_MISTAKE_TAGS.filter((name) => !taken.has(normalizeTagName(name)));
}
