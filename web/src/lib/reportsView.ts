import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultCardIds, REPORT_TAB_IDS, sanitizeCardIds, type ReportsTab } from "./reportCards";

/** Ordered visible card ids per tab; a missing tab means "all, default order". */
export type ReportsCardLayout = Partial<Record<ReportsTab, string[]>>;

interface ReportsViewState {
  cards: ReportsCardLayout;
  /** The last applied saved preset — highlighted in the switcher. Sticky
   *  through further edits; cleared only when that preset is deleted. */
  activePresetId?: string;
  setTabCards: (tab: ReportsTab, ids: string[]) => void;
  resetTabCards: (tab: ReportsTab) => void;
  applyLayout: (cards: ReportsCardLayout | undefined, presetId?: string) => void;
  setActivePreset: (id?: string) => void;
}

function sanitizeLayout(cards: ReportsCardLayout | undefined): ReportsCardLayout {
  if (!cards) return {};
  const out: ReportsCardLayout = {};
  for (const tab of REPORT_TAB_IDS) {
    const ids = cards[tab];
    if (ids !== undefined) out[tab] = sanitizeCardIds(tab, ids);
  }
  return out;
}

export const useReportsView = create<ReportsViewState>()(
  persist(
    (set) => ({
      cards: {},
      setTabCards: (tab, ids) =>
        set((s) => ({ cards: { ...s.cards, [tab]: sanitizeCardIds(tab, ids) } })),
      resetTabCards: (tab) =>
        set((s) => {
          const { [tab]: _, ...rest } = s.cards;
          return { cards: rest };
        }),
      applyLayout: (cards, presetId) =>
        set({ cards: sanitizeLayout(cards), activePresetId: presetId }),
      setActivePreset: (activePresetId) => set({ activePresetId }),
    }),
    { name: "tm_reports_view" },
  ),
);

/** Resolved visible ids for a tab — customized order if set, defaults otherwise. */
export function visibleCardIds(cards: ReportsCardLayout, tab: ReportsTab): string[] {
  const ids = cards[tab];
  return ids !== undefined ? sanitizeCardIds(tab, ids) : defaultCardIds(tab);
}
