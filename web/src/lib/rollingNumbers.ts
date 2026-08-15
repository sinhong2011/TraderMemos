/**
 * Arming for the rolling number animation (see `RollingNumber`).
 *
 * The stats in the header change for all sorts of reasons — a date range
 * picked, an account scoped out, a page mounted, a tab refocused, a reload
 * repainting figures the user has already seen. None of those are worth
 * animating: motion there is noise, and on load it is a page that appears to
 * be counting itself up.
 *
 * The one moment worth marking is the user's own write landing, so a trade
 * write *arms* the animation and the numbers roll only if they change while
 * armed. Everything else swaps silently.
 *
 * It's a window rather than a one-shot flag because a single write moves
 * several figures at once — P&L, win rate, profit factor, balance — and each
 * one is a separate component asking the same question. It's held in a module
 * rather than in state because nothing re-renders when the arming changes;
 * it's read once, at the moment a value actually moves.
 */

/**
 * How long a write stays armed. Long enough to cover the invalidate → refetch
 * → repaint round trip on a slow connection, short enough that a value moving
 * for some unrelated reason a moment later doesn't inherit the animation.
 */
const ARM_WINDOW_MS = 4000;

let armedUntil = 0;

/** Called by every mutation that rewrites trades. */
export function armRollingNumbers(): void {
  armedUntil = Date.now() + ARM_WINDOW_MS;
}

/** Whether a value changing right now was plausibly caused by that write. */
export function isRollArmed(): boolean {
  return Date.now() < armedUntil;
}

/** Tests only — the window is real time, and it leaks between cases. */
export function resetRollingNumbers(): void {
  armedUntil = 0;
}
