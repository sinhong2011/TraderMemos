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
