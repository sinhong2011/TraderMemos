import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Tailwind's `max-md` — the phone layout. Same 48rem boundary the nav uses
 * (`AppNav` is `hidden md:flex`, `MobileTabBar` is `md:hidden`), so a screen
 * either gets the whole phone treatment or none of it.
 */
export const COMPACT_VIEWPORT = "not all and (min-width: 48rem)";

function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Subscribe to a CSS media query.
 *
 * Uses `useSyncExternalStore` so the very first render already agrees with the
 * viewport — an effect-based hook would paint the desktop branch for a frame.
 * Returns `false` where `matchMedia` is unavailable (jsdom), so tests render
 * the wide layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = React.useCallback(
    () => (hasMatchMedia() ? window.matchMedia(query).matches : false),
    [query],
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
