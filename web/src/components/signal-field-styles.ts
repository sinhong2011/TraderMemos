/** Shared Tailwind classes for Signal form controls (shadcn Field pattern). */
export const signalLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

/**
 * Elevated graphite fill with a hairline border — shadcn inputs.
 * Height 40px (h-10) so fields read as solid chips on panel surfaces.
 */
export const signalInputClass =
  "h-10 w-full rounded-md border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55";

/** Trigger chrome shared by selects / date / datetime pickers. */
export const signalControlTriggerClass =
  "h-10 w-full rounded-md border border-border bg-muted px-3 text-[13px] text-foreground outline-none transition-[background-color] duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const signalFieldErrorClass = "mt-1 text-[10px] text-destructive";

export const signalFieldHintClass = "mt-1 text-[10px] text-muted-foreground";
