import { cn } from "@/lib/cn";

/**
 * Floating surface for the mobile tab capsule: an opaque `popover` fill (the
 * same tone as the app's overlays) and a hairline edge, so content scrolling
 * underneath is hidden rather than showing through. No drop shadow — the fill
 * and edge carry the separation on their own.
 */
export const floatingSurfaceClass = cn("bg-popover bg-clip-padding", "border border-input");

/**
 * coss ui outlined-control chrome — the `border-input` hairline, `bg-popover`
 * fill, hairline shadow, and `::before` bevel that the outline Button and the
 * other coss controls share, lifted onto larger blocks (list rows) so they read
 * as the same family. Needs `rounded-lg` on the element for the bevel to line up.
 * @see https://coss.com/ui/docs/components/button
 */
export const outlineSurfaceClass = cn(
  "relative border-input bg-popover not-dark:bg-clip-padding shadow-xs/5 dark:bg-input/32",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)]",
  "before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
  "transition-[background-color,box-shadow] duration-150",
);
