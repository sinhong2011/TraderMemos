import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Convenience controlled popover for trigger + content call sites. */
export function SignalPopover({
  open,
  onOpenChange,
  trigger,
  triggerClassName,
  triggerAriaLabel,
  children,
  align = "end",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={triggerAriaLabel}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 outline-none",
          triggerClassName,
        )}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("p-0", className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
