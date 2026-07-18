import { Copy, ExternalLink, Filter, MoreHorizontal, PanelRight } from "lucide-react";
import { useState } from "react";
import type { Trade } from "../lib/api/types";
import { cn } from "../lib/cn";
import { useToastManager } from "./Toast";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

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
  "h-auto w-full justify-start gap-2 rounded-control px-2.5 py-2",
  "text-[12px] text-text",
  "hover:bg-bg-hover hover:text-text",
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Actions for ${trade.symbol}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(triggerClass, open && "bg-bg-hover text-text")}
      >
        <MoreHorizontal size={14} strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="min-w-[180px] p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.onOpenDrawer ? (
          <Button
            type="button"
            variant="ghost"
            className={itemClass}
            onClick={() => run(() => actions.onOpenDrawer?.(trade))}
          >
            <PanelRight size={14} strokeWidth={1.5} aria-hidden />
            Open drawer
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className={itemClass}
          onClick={() => run(() => actions.onOpenFullPage(trade))}
        >
          <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
          Open full page
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={itemClass}
          onClick={() =>
            run(() => {
              void copySymbol();
            })
          }
        >
          <Copy size={14} strokeWidth={1.5} aria-hidden />
          Copy symbol
        </Button>
        {actions.onFilterSymbol ? (
          <Button
            type="button"
            variant="ghost"
            className={itemClass}
            onClick={() => run(() => actions.onFilterSymbol?.(trade.symbol))}
          >
            <Filter size={14} strokeWidth={1.5} aria-hidden />
            Filter by {trade.symbol}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
