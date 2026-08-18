/**
 * Arming for the rolling number animation (see `components/rolling-number`).
 *
 * Figures on the dashboard change for all sorts of reasons — a range picked, an
 * account scoped, a screen mounting, a query refetching on focus, a cold start
 * repainting numbers the user has already seen. None of those are worth
 * animating: motion there is noise, and on launch it is a screen that appears
 * to be counting itself up.
 *
 * The one moment worth marking is the user's own write landing, so a trade
 * write *arms* the animation and figures roll only if they change while armed.
 * Everything else swaps silently.
 *
 * It's a window rather than a one-shot flag because a single write moves
 * several figures at once, each a separate component asking the same question.
 * It's held in a module rather than in state because nothing re-renders when
 * the arming changes; it's read once, when a value actually moves.
 *
 * Mirrors `web/src/lib/rollingNumbers.ts` — keep the two in step.
 */

/**
 * How long a write stays armed. Long enough to cover the invalidate → refetch
 * → repaint round trip against a self-hosted server on a phone connection,
 * short enough that an unrelated change a moment later doesn't inherit it.
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
