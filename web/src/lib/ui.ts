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

/** Prefill payload when editing a journal note. */
export interface NoteDraft {
  id: string;
  type: "note" | "daily_log";
  occurredAt: string;
  title: string;
  body: string;
  symbols: Array<{ symbol: string; body: string }>;
}

interface UIState {
  modal: ModalKind | null;
  tradeDraft: TradeDraft | null;
  setupDraft: SetupDraft | null;
  noteDraft: NoteDraft | null;
  /** When set with modal `new-trade`, NewTradeDrawer opens in edit mode. */
  editTradeId: string | null;
  /** Snapshot used to prefill the edit form immediately (avoids empty-form race). */
  editTradeDetail: TradeDetail | null;
  /**
   * When editing an import-preview row, Apply calls this instead of the trades API.
   * Receives option_right from the form (empty string when unset).
   */
  importPreviewApply: ((optionRight: "" | "call" | "put") => void) | null;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  positionSizeOpen: boolean;
  kellyOpen: boolean;
  fxOpen: boolean;
  /** Off-canvas nav drawer shown below the `md` breakpoint (phones). */
  mobileNavOpen: boolean;
  openModal: (d: ModalKind) => void;
  openTradeFromSetup: (draft: TradeDraft) => void;
  openTradeEdit: (trade: TradeDetail) => void;
  /** Open New Trade drawer for an import preview row (Apply writes local overrides). */
  openImportTradePreview: (
    trade: TradeDetail,
    onApply: (optionRight: "" | "call" | "put") => void,
  ) => void;
  openSetupEdit: (draft: SetupDraft) => void;
  openNoteEdit: (draft: NoteDraft) => void;
  consumeTradeDraft: () => TradeDraft | null;
  consumeSetupDraft: () => SetupDraft | null;
  consumeNoteDraft: () => NoteDraft | null;
  closeModal: () => void;
  openCommandPalette: () => void;
  setCommandOpen: (open: boolean) => void;
  openPositionSize: () => void;
  setPositionSizeOpen: (open: boolean) => void;
  openKelly: () => void;
  setKellyOpen: (open: boolean) => void;
  openFx: () => void;
  setFxOpen: (open: boolean) => void;
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
  importPreviewApply: null as ((optionRight: "" | "call" | "put") => void) | null,
};

export const useUI = create<UIState>((set, get) => ({
  modal: null,
  tradeDraft: null,
  setupDraft: null,
  noteDraft: null,
  editTradeId: null,
  editTradeDetail: null,
  importPreviewApply: null,
  sidebarCollapsed: false,
  commandOpen: false,
  positionSizeOpen: false,
  kellyOpen: false,
  fxOpen: false,
  mobileNavOpen: false,
  openModal: (modal) =>
    set((s) =>
      s.modal === modal && s.setupDraft == null && s.noteDraft == null && s.editTradeId == null
        ? s
        : {
            modal,
            setupDraft: null,
            noteDraft: null,
            ...(modal === "new-trade" ? { ...clearEditTrade, tradeDraft: null } : {}),
          },
    ),
  openTradeFromSetup: (draft) =>
    set({ modal: "new-trade", tradeDraft: draft, noteDraft: null, ...clearEditTrade }),
  openTradeEdit: (trade) =>
    set({
      modal: "new-trade",
      editTradeId: trade.id,
      editTradeDetail: trade,
      importPreviewApply: null,
      tradeDraft: null,
      setupDraft: null,
      noteDraft: null,
    }),
  openImportTradePreview: (trade, onApply) =>
    set({
      modal: "new-trade",
      editTradeId: trade.id,
      editTradeDetail: trade,
      importPreviewApply: onApply,
      tradeDraft: null,
      setupDraft: null,
      noteDraft: null,
    }),
  openSetupEdit: (draft) => set({ modal: "new-setup", setupDraft: draft, noteDraft: null }),
  openNoteEdit: (draft) => set({ modal: "new-note", noteDraft: draft, setupDraft: null }),
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
  consumeNoteDraft: () => {
    const draft = get().noteDraft;
    set({ noteDraft: null });
    return draft;
  },
  closeModal: () =>
    set({ modal: null, tradeDraft: null, setupDraft: null, noteDraft: null, ...clearEditTrade }),
  openCommandPalette: () => set({ commandOpen: true }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openPositionSize: () => set({ positionSizeOpen: true }),
  setPositionSizeOpen: (positionSizeOpen) => set({ positionSizeOpen }),
  openKelly: () => set({ kellyOpen: true }),
  setKellyOpen: (kellyOpen) => set({ kellyOpen }),
  openFx: () => set({ fxOpen: true }),
  setFxOpen: (fxOpen) => set({ fxOpen }),
  openDrawer: (modal) =>
    set({
      modal,
      setupDraft: null,
      noteDraft: null,
      ...(modal === "new-trade" ? { ...clearEditTrade, tradeDraft: null } : {}),
    }),
  closeDrawer: () =>
    set({ modal: null, tradeDraft: null, setupDraft: null, noteDraft: null, ...clearEditTrade }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
