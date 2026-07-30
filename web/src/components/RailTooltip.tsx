import { cn } from "@/lib/cn";

/**
 * Label for the collapsed nav rail — the rail shows icons only, so every
 * trigger needs its name on hover/focus. Rendered inside the trigger itself
 * (which owns `group` + `relative`), so it tracks the icon without a portal.
 */
export function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50",
        "-translate-y-1/2 translate-x-1",
        "rounded-md border border-border bg-popover px-2 py-1",
        "text-[11px] tracking-wide whitespace-nowrap text-popover-foreground",
        "opacity-0 transition-[opacity,transform] duration-150 ease-out",
        "group-hover:translate-x-0 group-hover:opacity-100",
        "group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
        "motion-reduce:transition-none motion-reduce:translate-x-0",
      )}
    >
      {label}
    </span>
  );
}
