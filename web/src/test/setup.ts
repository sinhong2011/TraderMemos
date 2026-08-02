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
if (typeof localStorage === "undefined" || typeof localStorage.getItem !== "function") {
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

// jsdom ships no Web Animations API; base-ui's ScrollArea viewport (combobox /
// select popups) calls getAnimations on a timer after mount.
if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

// jsdom has no PointerEvent constructor; base-ui's Switch re-dispatches click
// activation as a pointer event.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "";
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}
