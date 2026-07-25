/** Shared form control styles — aligned with coss ui Input / SelectTrigger chrome. */

export const fieldLabelClass =
  "mb-1.5 block text-[13px] font-medium tracking-normal text-muted-foreground";

/**
 * Standalone control surface matching coss `Input` (height, radius, border, shadow).
 * Prefer `<Input>` / `<FormInput>` when possible; use this for raw triggers & read-only chips.
 */
export const fieldInputClass =
  "relative inline-flex h-8.5 w-full min-w-0 items-center rounded-lg border border-input bg-background px-[calc(--spacing(3)-1px)] py-0 text-sm text-foreground shadow-xs/5 outline-none transition-shadow not-dark:bg-clip-padding placeholder:text-muted-foreground/72 hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 disabled:cursor-not-allowed disabled:opacity-64 sm:h-7.5 dark:bg-input/32 dark:hover:bg-input/48";

/** Trigger chrome shared by date / datetime pickers — same footprint as `fieldInputClass`. */
export const fieldControlTriggerClass = fieldInputClass;

export const fieldErrorClass = "mt-1.5 text-xs text-destructive";

export const fieldHintClass =
  "mt-1.5 text-xs leading-relaxed text-muted-foreground [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-foreground/85";
