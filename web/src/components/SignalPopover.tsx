import { Popover } from "@base-ui/react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { signalOverlayPopupClass } from "./signal-overlay-styles";

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
    <Popover.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Popover.Trigger
        aria-label={triggerAriaLabel}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 outline-none",
          triggerClassName,
        )}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align={align}
          sideOffset={6}
          positionMethod="fixed"
          className="z-[400]"
        >
          <Popover.Popup className={cn(signalOverlayPopupClass, className)}>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
