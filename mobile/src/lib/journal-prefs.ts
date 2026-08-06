/**
 * Journaling rules — currently just the per-trade screenshot cap. Separate
 * from display prefs because it is a capture rule, not a formatting one: it
 * lives under Trading & journal in Settings, travels in the app-config file's
 * `journal_prefs` section, and must survive the Display screen's "Reset to
 * defaults". Mirrors web's `journalPrefs` store.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { JOURNAL_PERSIST_KEY, migrateLegacyPrefs } from '@/lib/prefs-migration';
import { mmkvStorage } from '@/storage/zustand-mmkv';

export type JournalPrefs = {
  /** Cap on screenshots per trade; `null` = unlimited. */
  maxScreenshotsPerTrade: number | null;
};

const DEFAULTS: JournalPrefs = { maxScreenshotsPerTrade: null };

migrateLegacyPrefs();

/** A cap below 1 would block every attachment — treat it as "no cap". */
function sanitize(raw: unknown): JournalPrefs {
  const value = (raw as JournalPrefs | undefined)?.maxScreenshotsPerTrade;
  return {
    maxScreenshotsPerTrade:
      typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : null,
  };
}

const useJournalStore = create<JournalPrefs>()(
  persist((): JournalPrefs => DEFAULTS, {
    name: JOURNAL_PERSIST_KEY,
    storage: mmkvStorage<JournalPrefs>(),
    merge: (persisted) => sanitize(persisted),
  }),
);

/** Non-reactive read for the attachment guards. */
export function getJournalPrefs(): JournalPrefs {
  return useJournalStore.getState();
}

export function useJournalPrefs(): JournalPrefs {
  return useJournalStore();
}

export function setMaxScreenshotsPerTrade(max: number | null) {
  useJournalStore.setState(sanitize({ maxScreenshotsPerTrade: max }));
}

/** Apply a validated patch (app-config import). */
export function applyJournalPrefs(patch: Partial<JournalPrefs>) {
  if (patch.maxScreenshotsPerTrade !== undefined) {
    setMaxScreenshotsPerTrade(patch.maxScreenshotsPerTrade);
  }
}
