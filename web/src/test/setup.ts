import "@testing-library/jest-dom";

// Polyfill ResizeObserver for jsdom (used by Recharts ResponsiveContainer and
// @tanstack/react-virtual).
if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

// localStorage arrives as a bare object without Storage methods under this
// vitest/jsdom combination; give tests a real in-memory implementation.
if (
	typeof localStorage === "undefined" ||
	typeof localStorage.getItem !== "function"
) {
	const store = new Map<string, string>();
	const memoryStorage: Storage = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
		key: (i) => [...store.keys()][i] ?? null,
		removeItem: (k) => {
			store.delete(k);
		},
		setItem: (k, v) => {
			store.set(k, String(v));
		},
	};
	Object.defineProperty(globalThis, "localStorage", {
		value: memoryStorage,
		writable: true,
		configurable: true,
	});
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {};
}
