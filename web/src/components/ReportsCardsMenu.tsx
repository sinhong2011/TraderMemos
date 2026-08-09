import { Check, ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { defaultCardIds, REPORT_CARDS, type ReportsTab } from "@/lib/reportCards";
import { useReportsView, visibleCardIds } from "@/lib/reportsView";
import { filterChipClass } from "./field-styles";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/**
 * Per-tab card visibility + order editor. Order is expressed as the visible
 * list itself: hidden cards drop to the bottom and re-append on show.
 */
export function ReportsCardsMenu({ tab }: { tab: ReportsTab }) {
  const [open, setOpen] = useState(false);
  const cards = useReportsView((s) => s.cards);
  const setTabCards = useReportsView((s) => s.setTabCards);
  const resetTabCards = useReportsView((s) => s.resetTabCards);

  const defs = REPORT_CARDS[tab];
  const labels = new Map(defs.map((d) => [d.id, d.label]));
  const visible = visibleCardIds(cards, tab);
  const hidden = defaultCardIds(tab).filter((id) => !visible.includes(id));
  const customized = cards[tab] !== undefined;

  const toggle = (id: string) => {
    if (visible.includes(id)) {
      if (visible.length <= 1) return;
      setTabCards(
        tab,
        visible.filter((v) => v !== id),
      );
    } else {
      setTabCards(tab, [...visible, id]);
    }
  };

  const move = (id: string, delta: -1 | 1) => {
    const index = visible.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= visible.length) return;
    const next = [...visible];
    next[index] = next[target];
    next[target] = id;
    setTabCards(tab, next);
  };

  const row = (id: string, isVisible: boolean, index: number) => (
    <div key={id} className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => toggle(id)}
        disabled={isVisible && visible.length <= 1}
        aria-pressed={isVisible}
        className={cn(
          "flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-[12.5px]",
          "transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-60",
          isVisible ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
            isVisible
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent",
          )}
          aria-hidden
        >
          {isVisible && <Check size={11} strokeWidth={2.5} />}
        </span>
        <span className="truncate">{labels.get(id)}</span>
      </button>
      {isVisible && (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Move ${labels.get(id)} up`}
            onClick={() => move(id, -1)}
            disabled={index === 0}
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            <ChevronUp size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={`Move ${labels.get(id)} down`}
            onClick={() => move(id, 1)}
            disabled={index === visible.length - 1}
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Customize cards"
        className={cn(filterChipClass, "cursor-pointer", (open || customized) && "bg-accent")}
      >
        <LayoutGrid size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        Cards
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-muted-foreground">
          Cards on this tab
        </p>
        <div className="flex flex-col">
          {visible.map((id, i) => row(id, true, i))}
          {hidden.map((id) => row(id, false, -1))}
        </div>
        {customized && (
          <div className="mt-1.5 border-t border-border pt-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="w-full justify-start text-muted-foreground"
              onClick={() => resetTabCards(tab)}
            >
              Reset to default
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
