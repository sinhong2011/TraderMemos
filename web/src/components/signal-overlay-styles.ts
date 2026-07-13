import { cn } from "../lib/cn";

/** Shared enter/exit motion for floating overlays (popover, select, menus). */
export const signalOverlayPopupClass = cn(
  "rounded-overlay border border-border-strong bg-bg-panel outline-none",
  "shadow-[0_12px_32px_rgba(0,0,0,0.45)]",
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
  "relative flex min-h-9 cursor-pointer items-center gap-2.5 rounded-control py-2 pr-2.5 pl-3",
  "text-[12px] text-text outline-none",
  "transition-[background-color,color] duration-100 ease-out",
  "before:absolute before:top-1/2 before:left-1 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-accent before:opacity-0 before:shadow-[0_0_6px_var(--color-accent-glow)] before:content-[''] before:transition-opacity before:duration-100",
  "data-[highlighted]:bg-bg-hover data-[highlighted]:text-text",
  "data-[selected]:bg-accent-bg data-[selected]:font-medium data-[selected]:text-accent data-[selected]:before:opacity-100",
  "data-[disabled]:cursor-default data-[disabled]:opacity-40",
  "motion-reduce:transition-none motion-reduce:before:transition-none",
);
