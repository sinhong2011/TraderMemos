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

interface UIState {
  modal: ModalKind | null;
  tradeDraft: TradeDraft | null;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  positionSizeOpen: boolean;
  openModal: (d: ModalKind) => void;
  openTradeFromSetup: (draft: TradeDraft) => void;
  consumeTradeDraft: () => TradeDraft | null;
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
}

export const useUI = create<UIState>((set, get) => ({
  modal: null,
  tradeDraft: null,
  sidebarCollapsed: false,
  commandOpen: false,
  positionSizeOpen: false,
  openModal: (modal) => set({ modal }),
  openTradeFromSetup: (draft) => set({ modal: "new-trade", tradeDraft: draft }),
  consumeTradeDraft: () => {
    const draft = get().tradeDraft;
    set({ tradeDraft: null });
    return draft;
  },
  closeModal: () => set({ modal: null, tradeDraft: null }),
  openCommandPalette: () => set({ commandOpen: true }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openPositionSize: () => set({ positionSizeOpen: true }),
  setPositionSizeOpen: (positionSizeOpen) => set({ positionSizeOpen }),
  openDrawer: (modal) => set({ modal }),
  closeDrawer: () => set({ modal: null, tradeDraft: null }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
