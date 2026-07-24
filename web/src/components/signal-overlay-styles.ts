import { cn } from "../lib/cn";

/** Shared enter/exit motion for floating overlays (popover, select, menus). */
export const signalOverlayPopupClass = cn(
  "rounded-lg border border-border bg-card outline-none",
  "shadow-[0_12px_32px_rgba(18,18,24,0.55)]",
  "origin-[var(--transform-origin)]",
  "transition-[transform,opacity] duration-[220ms] ease-out",
  "data-[starting-style]:translate-y-[-6px] data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
  "data-[ending-style]:translate-y-[-3px] data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0",
  "motion-reduce:transition-none motion-reduce:duration-0",
  "motion-reduce:data-[starting-style]:translate-y-0 motion-reduce:data-[ending-style]:translate-y-0",
  "motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
);

export const signalSelectListClass = "flex flex-col gap-0.5 p-1.5";

export const signalSelectItemClass = cn(
  "relative flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md py-2 pr-2.5 pl-3",
  "text-[12px] text-foreground outline-none",
  "transition-[background-color,color] duration-100 ease-out",
  "data-[highlighted]:bg-accent data-[highlighted]:text-foreground",
  "data-[selected]:bg-primary/10 data-[selected]:font-medium data-[selected]:text-primary",
  "data-[disabled]:cursor-default data-[disabled]:opacity-40",
  "motion-reduce:transition-none",
);
