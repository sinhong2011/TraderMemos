import { create } from "zustand";

export type DrawerKind = "new-trade" | "new-setup";

interface UIState {
	drawer: DrawerKind | null;
	sidebarCollapsed: boolean;
	openDrawer: (d: DrawerKind) => void;
	closeDrawer: () => void;
	toggleSidebar: () => void;
}

export const useUI = create<UIState>((set) => ({
	drawer: null,
	sidebarCollapsed: false,
	openDrawer: (drawer) => set({ drawer }),
	closeDrawer: () => set({ drawer: null }),
	toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
