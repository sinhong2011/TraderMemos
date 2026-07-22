import { create } from "zustand";
import type { TradeDetail } from "./api/types";

export type ModalKind = "new-trade" | "new-setup" | "new-note";

/** Prefill payload when converting a setup → New Trade. */
export interface TradeDraft {
  setupId?: string;
  symbol?: string;
  side?: "long" | "short";
  target?: string;
  stop?: string;
  notes?: string;
}

/** Prefill payload when editing a setup in NewSetupDrawer. */
export interface SetupDraft {
  id: string;
  name: string;
  thesis: string;
  symbol: string;
  direction: "long" | "short";
  target: string;
  stop: string;
  checklistText: string;
}

interface UIState {
  modal: ModalKind | null;
  tradeDraft: TradeDraft | null;
  setupDraft: SetupDraft | null;
  /** When set with modal `new-trade`, NewTradeDrawer opens in edit mode. */
  editTradeId: string | null;
  /** Snapshot used to prefill the edit form immediately (avoids empty-form race). */
  editTradeDetail: TradeDetail | null;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  positionSizeOpen: boolean;
  /** Off-canvas nav drawer shown below the `md` breakpoint (phones). */
  mobileNavOpen: boolean;
  openModal: (d: ModalKind) => void;
  openTradeFromSetup: (draft: TradeDraft) => void;
  openTradeEdit: (trade: TradeDetail) => void;
  openSetupEdit: (draft: SetupDraft) => void;
  consumeTradeDraft: () => TradeDraft | null;
  consumeSetupDraft: () => SetupDraft | null;
  closeModal: () => void;
  openCommandPalette: () => void;
  setCommandOpen: (open: boolean) => void;
  openPositionSize: () => void;
  setPositionSizeOpen: (open: boolean) => void;
  /** @deprecated Use openModal */
  openDrawer: (d: ModalKind) => void;
  /** @deprecated Use closeModal */
  closeDrawer: () => void;
  toggleSidebar: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

const clearEditTrade = {
  editTradeId: null as string | null,
  editTradeDetail: null as TradeDetail | null,
};

export const useUI = create<UIState>((set, get) => ({
  modal: null,
  tradeDraft: null,
  setupDraft: null,
  editTradeId: null,
  editTradeDetail: null,
  sidebarCollapsed: false,
  commandOpen: false,
  positionSizeOpen: false,
  mobileNavOpen: false,
  openModal: (modal) =>
    set((s) =>
      s.modal === modal && s.setupDraft == null && s.editTradeId == null
        ? s
        : {
            modal,
            setupDraft: null,
            ...(modal === "new-trade" ? { ...clearEditTrade, tradeDraft: null } : {}),
          },
    ),
  openTradeFromSetup: (draft) => set({ modal: "new-trade", tradeDraft: draft, ...clearEditTrade }),
  openTradeEdit: (trade) =>
    set({
      modal: "new-trade",
      editTradeId: trade.id,
      editTradeDetail: trade,
      tradeDraft: null,
      setupDraft: null,
    }),
  openSetupEdit: (draft) => set({ modal: "new-setup", setupDraft: draft }),
  consumeTradeDraft: () => {
    const draft = get().tradeDraft;
    set({ tradeDraft: null });
    return draft;
  },
  consumeSetupDraft: () => {
    const draft = get().setupDraft;
    set({ setupDraft: null });
    return draft;
  },
  closeModal: () => set({ modal: null, tradeDraft: null, setupDraft: null, ...clearEditTrade }),
  openCommandPalette: () => set({ commandOpen: true }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openPositionSize: () => set({ positionSizeOpen: true }),
  setPositionSizeOpen: (positionSizeOpen) => set({ positionSizeOpen }),
  openDrawer: (modal) =>
    set({
      modal,
      setupDraft: null,
      ...(modal === "new-trade" ? { ...clearEditTrade, tradeDraft: null } : {}),
    }),
  closeDrawer: () => set({ modal: null, tradeDraft: null, setupDraft: null, ...clearEditTrade }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
