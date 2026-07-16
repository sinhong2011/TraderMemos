import { Popover } from "@base-ui/react";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { APP_HOTKEYS } from "../lib/hotkeys";
import { TOOL_ITEMS } from "../lib/tools";
import { useToolRunner } from "../lib/useToolRunner";
import { useUI } from "../lib/ui";
import { signalKbdClass } from "./signal-field-styles";

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50",
        "-translate-y-1/2 translate-x-1",
        "rounded-control border border-border bg-bg-panel px-2 py-1",
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

export function ToolsPopover({ variant = "rail" }: { variant?: "rail" | "header" }) {
  const [open, setOpen] = useState(false);
  const runTool = useToolRunner();
  const openCommandPalette = useUI((s) => s.openCommandPalette);
  const isHeader = variant === "header";

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger
        title="Tools"
        aria-label="Tools"
        className={cn(
          "group relative flex cursor-pointer items-center justify-center rounded-control outline-none",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "motion-reduce:transition-none",
          isHeader ? "size-8" : "size-9",
          open
            ? "bg-[rgba(228,255,26,0.12)] text-signal"
            : isHeader
              ? "bg-bg-input text-signal hover:bg-bg-input-hover"
              : "text-signal hover:bg-[rgba(228,255,26,0.08)]",
        )}
      >
        <Wrench
          size={isHeader ? 15 : 20}
          strokeWidth={1.75}
          className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
        {!isHeader ? <RailTooltip label="Tools" /> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={isHeader ? "bottom" : "right"}
          align="end"
          sideOffset={isHeader ? 6 : 8}
          positionMethod="fixed"
          className="z-[400]"
        >
          <Popover.Popup
            className={cn(
              "w-[248px] rounded-overlay border border-border-strong bg-bg-panel p-3 outline-none",
              "shadow-[0_12px_32px_rgba(18,18,24,0.55)]",
              "origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "motion-reduce:transition-none motion-reduce:data-[starting-style]:scale-100 motion-reduce:data-[ending-style]:scale-100",
            )}
          >
            <p className="m-0 px-1 text-[10px] font-medium uppercase tracking-widest text-signal">
              Tools
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {TOOL_ITEMS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.label}
                    onClick={() => {
                      setOpen(false);
                      runTool(tool.id);
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center gap-1 rounded-control px-1 py-2",
                      "text-text-dim transition-colors hover:bg-bg-hover hover:text-text",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    <span className="max-w-full truncate text-[9px] leading-tight">
                      {tool.label.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openCommandPalette();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-control px-2 py-1.5",
                  "text-[11px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text",
                )}
              >
                <span>All commands</span>
                <kbd className={signalKbdClass}>{APP_HOTKEYS.palette.label}</kbd>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
