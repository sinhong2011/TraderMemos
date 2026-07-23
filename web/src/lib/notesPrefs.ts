import { create } from "zustand";
import { persist } from "zustand/middleware";

export const NOTES_PREFS_STORAGE_KEY = "tm-notes-prefs";

export type NotesLayout = "list" | "cards";

interface NotesPrefsState {
  layout: NotesLayout;
  setLayout: (layout: NotesLayout) => void;
}

function normalizeLayout(value: unknown): NotesLayout {
  return value === "cards" ? "cards" : "list";
}

export const useNotesPrefs = create<NotesPrefsState>()(
  persist(
    (set) => ({
      layout: "list",
      setLayout: (layout) => set({ layout: normalizeLayout(layout) }),
    }),
    {
      name: NOTES_PREFS_STORAGE_KEY,
      partialize: (s) => ({ layout: s.layout }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<NotesPrefsState> | undefined;
        return {
          ...current,
          layout: normalizeLayout(raw?.layout),
        };
      },
    },
  ),
);
