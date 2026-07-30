/**
 * View-transition type for a route change, matched by
 * `:active-view-transition-type()` in `global.css`.
 *
 * `<main>` is captured for *any* view transition on the page — the calendar's
 * month/year toggle starts one of its own — so the page animation is gated on
 * this type rather than applied to every capture.
 */
const PAGE_NAV = "page-nav";

type LocationChangeInfo = {
  fromLocation?: { pathname: string };
  toLocation: { pathname: string };
  pathChanged: boolean;
};

/**
 * Picks the transition type for a navigation, or `false` to skip the transition
 * entirely — the router treats a `false` result as "just update the DOM".
 */
export function pageViewTransitionTypes({
  fromLocation,
  pathChanged,
}: LocationChangeInfo): Array<string> | false {
  // No `fromLocation` means the app's first paint — there is nothing to
  // transition from. Search-param changes (report tabs, trade filters) are
  // in-page state, not navigation; animating them would flash the whole page on
  // every filter tweak.
  if (!pathChanged || !fromLocation) return false;

  return [PAGE_NAV];
}
