import { create } from "zustand";
import { persist } from "zustand/middleware";

export const JOURNAL_PREFS_STORAGE_KEY = "tm-journal-prefs";

/** `null` = no limit. Positive integer caps screenshots per trade (new trade + uploads). */
export type MaxScreenshots = number | null;

interface JournalPrefsState {
  maxScreenshotsPerTrade: MaxScreenshots;
  setMaxScreenshotsPerTrade: (n: MaxScreenshots) => void;
}

function normalizeMax(value: unknown): MaxScreenshots {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 100);
}

export const useJournalPrefs = create<JournalPrefsState>()(
  persist(
    (set) => ({
      maxScreenshotsPerTrade: null,
      setMaxScreenshotsPerTrade: (maxScreenshotsPerTrade) =>
        set({ maxScreenshotsPerTrade: normalizeMax(maxScreenshotsPerTrade) }),
    }),
    {
      name: JOURNAL_PREFS_STORAGE_KEY,
      partialize: (s) => ({ maxScreenshotsPerTrade: s.maxScreenshotsPerTrade }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<JournalPrefsState> | undefined;
        return {
          ...current,
          maxScreenshotsPerTrade: normalizeMax(raw?.maxScreenshotsPerTrade),
        };
      },
    },
  ),
);

/** Apply optional cap; unlimited when max is null. */
export function capScreenshots<T>(files: T[], max: MaxScreenshots): T[] {
  if (max == null) return files;
  return files.slice(0, max);
}
