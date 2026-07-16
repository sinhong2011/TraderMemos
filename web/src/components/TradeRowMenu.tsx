import { Popover } from "@base-ui/react";
import { Copy, ExternalLink, Filter, MoreHorizontal, PanelRight } from "lucide-react";
import { useState } from "react";
import type { Trade } from "../lib/api/types";
import { cn } from "../lib/cn";
import { signalOverlayPopupClass } from "./signal-overlay-styles";
import { useToastManager } from "./Toast";

export interface TradeRowActions {
  /** Quick peek drawer. Omit when the list already opens the full page on row click. */
  onOpenDrawer?: (trade: Trade) => void;
  /** Navigate to /trades/:id */
  onOpenFullPage: (trade: Trade) => void;
  /** Set the global symbol filter */
  onFilterSymbol?: (symbol: string) => void;
}

const triggerClass = cn(
  "-my-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-control",
  "text-text-muted transition-colors hover:bg-bg-hover hover:text-text",
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
);

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-2",
  "text-[12px] text-text outline-none",
  "transition-colors duration-100 hover:bg-bg-hover",
  "motion-reduce:transition-none",
);

export function TradeRowMenu({ trade, actions }: { trade: Trade; actions: TradeRowActions }) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  async function copySymbol() {
    try {
      await navigator.clipboard.writeText(trade.symbol);
      toast.add({ title: "Copied", description: trade.symbol });
    } catch {
      toast.add({
        title: "Could not copy",
        description: "Clipboard access was blocked",
      });
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger
        aria-label={`Actions for ${trade.symbol}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(triggerClass, open && "bg-bg-hover text-text")}
      >
        <MoreHorizontal size={14} strokeWidth={1.5} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          positionMethod="fixed"
          className="z-[400]"
        >
          <Popover.Popup
            className={cn(signalOverlayPopupClass, "min-w-[180px] p-1.5")}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.onOpenDrawer ? (
              <button
                type="button"
                className={itemClass}
                onClick={() => run(() => actions.onOpenDrawer?.(trade))}
              >
                <PanelRight size={14} strokeWidth={1.5} aria-hidden />
                Open drawer
              </button>
            ) : null}
            <button
              type="button"
              className={itemClass}
              onClick={() => run(() => actions.onOpenFullPage(trade))}
            >
              <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
              Open full page
            </button>
            <button
              type="button"
              className={itemClass}
              onClick={() =>
                run(() => {
                  void copySymbol();
                })
              }
            >
              <Copy size={14} strokeWidth={1.5} aria-hidden />
              Copy symbol
            </button>
            {actions.onFilterSymbol ? (
              <button
                type="button"
                className={itemClass}
                onClick={() => run(() => actions.onFilterSymbol?.(trade.symbol))}
              >
                <Filter size={14} strokeWidth={1.5} aria-hidden />
                Filter by {trade.symbol}
              </button>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
