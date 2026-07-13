import { Popover } from "@base-ui-components/react";
import { CircleUser, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";
import { signalOverlayPopupClass } from "./signal-overlay-styles";

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50",
        "-translate-y-1/2 translate-x-1",
        "rounded-control bg-bg-panel px-2 py-1",
        "text-[11px] tracking-wide whitespace-nowrap text-text-muted",
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

export function AccountNavPopover() {
  const [open, setOpen] = useState(false);
  const signOut = useAuth((s) => s.signOut);

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger
        title="Session"
        aria-label="Session"
        className={cn(
          "group relative flex size-9 cursor-pointer items-center justify-center rounded-control outline-none",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "motion-reduce:transition-none",
          open ? "bg-accent-bg text-accent" : "text-text-dim hover:bg-bg-hover hover:text-text",
        )}
      >
        <CircleUser
          size={20}
          strokeWidth={1.75}
          className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
        <RailTooltip label="Session" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="right"
          align="end"
          sideOffset={8}
          positionMethod="fixed"
          className="z-[400]"
        >
          <Popover.Popup className={cn(signalOverlayPopupClass, "w-[200px] p-2")}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-center gap-2 rounded-control py-2",
                "text-[11px] font-medium text-text-muted transition-colors duration-150",
                "hover:bg-bg-hover hover:text-text",
              )}
            >
              <LogOut size={14} strokeWidth={1.75} aria-hidden />
              Sign out
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
