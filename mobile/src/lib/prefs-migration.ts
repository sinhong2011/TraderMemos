/**
 * One-time split of the pre-zustand `prefs:display` blob.
 *
 * ---------------------------------------------------------------------------
 * REMOVE AFTER 0.4.3 HAS BEEN OUT ~3 RELEASES (or ~6 months)
 *
 * Added in 0.4.3, when the hand-rolled module stores became zustand + persist.
 * It exists only for installs upgrading *across* that version: it runs once at
 * module scope, rewrites the old value under the new `store:*` key, deletes
 * the old key, and does nothing on every launch after.
 *
 * Cutting it early is not dangerous, just rude — anyone who skips 0.4.3
 * entirely gets defaults back (timezone to New York, account scope to All,
 * calculator sessions empty). No crash and no trade data is involved; the
 * stores' `merge` sanitizers already handle an absent key.
 *
 * When removing, delete all four pieces:
 *   1. this file, and the `migrateLegacyPrefs()` calls in prefs.ts and
 *      journal-prefs.ts
 *   2. `adoptLegacyValue` / `legacyJSON` in storage/zustand-mmkv.ts
 *   3. every `LEGACY_KEY` / `adoptLegacyValue(...)` block in account-store.ts,
 *      tag-bar.ts, event-filters.ts, event-reminders.ts, checklist.ts,
 *      checklist-reminders.ts, reports-display.ts and r-calculator/store.ts
 *   4. the orphaned keys themselves: prefs:display, prefs:selected-account,
 *      events:filters, events:reminders, reports:controls,
 *      checklist:weekdaysOnly, checklist:reminders:on, checklist:reminders:time,
 *      r-calc:sessions, r-calc:fvg-sessions
 *
 * Keep the `merge` sanitizers. Those are not migration code — they are what
 * stops a hand-edited or half-written blob from wedging a screen.
 * ---------------------------------------------------------------------------
 *
 * That single MMKV entry held the formatting prefs *and* the screenshots cap.
 * They are now two stores — matching web's `displayPrefs` / `journalPrefs` —
 * so the old value has to be dealt out between them before either store reads
 * its key. Both stores call this at module scope; whichever loads first wins
 * and the second call is a no-op.
 *
 * Fields are copied verbatim: each store's `merge` validates what it reads, so
 * this doesn't need to know either schema (and can't import them without a
 * cycle).
 */
import { storage } from '@/storage/mmkv';
import { adoptLegacyValue, legacyJSON } from '@/storage/zustand-mmkv';

export const DISPLAY_PERSIST_KEY = 'store:display-prefs';
export const JOURNAL_PERSIST_KEY = 'store:journal-prefs';

const LEGACY_KEY = 'prefs:display';

let done = false;

export function migrateLegacyPrefs(): void {
  if (done) return;
  done = true;
  const legacy = legacyJSON(LEGACY_KEY);
  if (typeof legacy === 'object' && legacy !== null) {
    const { maxScreenshotsPerTrade, ...display } = legacy as Record<string, unknown>;
    adoptLegacyValue(DISPLAY_PERSIST_KEY, [], () => display);
    adoptLegacyValue(JOURNAL_PERSIST_KEY, [], () => ({
      maxScreenshotsPerTrade: maxScreenshotsPerTrade ?? null,
    }));
  }
  storage.remove(LEGACY_KEY);
}
