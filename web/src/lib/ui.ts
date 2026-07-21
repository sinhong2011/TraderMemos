import { create } from "zustand";

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
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  positionSizeOpen: boolean;
  /** Off-canvas nav drawer shown below the `md` breakpoint (phones). */
  mobileNavOpen: boolean;
  openModal: (d: ModalKind) => void;
  openTradeFromSetup: (draft: TradeDraft) => void;
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

export const useUI = create<UIState>((set, get) => ({
  modal: null,
  tradeDraft: null,
  setupDraft: null,
  sidebarCollapsed: false,
  commandOpen: false,
  positionSizeOpen: false,
  mobileNavOpen: false,
  openModal: (modal) =>
    set((s) => (s.modal === modal && s.setupDraft == null ? s : { modal, setupDraft: null })),
  openTradeFromSetup: (draft) => set({ modal: "new-trade", tradeDraft: draft }),
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
  closeModal: () => set({ modal: null, tradeDraft: null, setupDraft: null }),
  openCommandPalette: () => set({ commandOpen: true }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openPositionSize: () => set({ positionSizeOpen: true }),
  setPositionSizeOpen: (positionSizeOpen) => set({ positionSizeOpen }),
  openDrawer: (modal) => set({ modal, setupDraft: null }),
  closeDrawer: () => set({ modal: null, tradeDraft: null, setupDraft: null }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
