import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface FilterState {
	accountId?: string;
	from?: string;
	to?: string;
	symbol?: string;
	setAccount: (id?: string) => void;
	setRange: (from?: string, to?: string) => void;
	setSymbol: (s?: string) => void;
	reset: () => void;
	toParams: () => {
		account_id?: string;
		from?: string;
		to?: string;
		symbol?: string;
	};
}

export const useFilters = create<FilterState>((set, get) => ({
	setAccount: (accountId) => set({ accountId }),
	setRange: (from, to) => set({ from, to }),
	setSymbol: (symbol) => set({ symbol }),
	reset: () =>
		set({
			accountId: undefined,
			from: undefined,
			to: undefined,
			symbol: undefined,
		}),
	toParams: () => {
		const s = get();
		return {
			account_id: s.accountId,
			from: s.from,
			to: s.to,
			symbol: s.symbol,
		};
	},
}));

// useFilterParams returns the shared filter query params with a SHALLOW-stable
// reference. Selecting `s.toParams()` directly returns a fresh object every
// render, which under Zustand v5's Object.is comparison causes an infinite
// render loop. useShallow fixes that by comparing the object's keys.
export function useFilterParams() {
	return useFilters(
		useShallow((s) => ({
			account_id: s.accountId,
			from: s.from,
			to: s.to,
			symbol: s.symbol,
		})),
	);
}
