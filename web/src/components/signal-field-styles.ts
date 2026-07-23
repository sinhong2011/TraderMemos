/** Shared Tailwind classes for Signal form controls (shadcn Field pattern). */
export const signalLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted";

/**
 * Elevated graphite fill with a hairline border — Signal Terminal inputs.
 * Height 40px (h-10) so fields read as solid chips on panel surfaces.
 */
export const signalInputClass =
  "h-10 w-full rounded-control border border-border bg-bg-input px-3 text-[13px] text-text outline-none transition-colors duration-150 placeholder:text-text-dim hover:bg-bg-input-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-55";

/** Trigger chrome shared by selects / date / datetime pickers. */
export const signalControlTriggerClass =
  "h-10 w-full rounded-control border border-border bg-bg-input px-3 text-[13px] text-text outline-none transition-[background-color] duration-150 hover:bg-bg-input-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong";

export const signalFieldErrorClass = "mt-1 text-[10px] text-loss";

export const signalFieldHintClass = "mt-1 text-[10px] text-text-muted";
