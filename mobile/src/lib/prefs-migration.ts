/**
 * One-time split of the pre-zustand `prefs:display` blob.
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
