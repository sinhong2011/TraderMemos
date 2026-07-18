import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import type { OcrSymbolGroup } from "../lib/ocrSymbolGroups";

function qtySummary(g: OcrSymbolGroup): string {
  const parts: string[] = [];
  if (g.buyQty > 0) parts.push(`${formatQty(g.buyQty)}B`);
  if (g.sellQty > 0) parts.push(`${formatQty(g.sellQty)}S`);
  return parts.join(" / ") || "—";
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function OcrSymbolGroupList({
  groups,
  selected,
  logged,
  onSelect,
  readOnly = false,
}: {
  groups: OcrSymbolGroup[];
  selected: string;
  logged: ReadonlySet<string>;
  onSelect: (symbol: string) => void;
  /** Present a loaded OCR batch without offering sequential symbol selection. */
  readOnly?: boolean;
}) {
  if (groups.length === 0) return null;
  const sel = selected.trim().toUpperCase();

  return (
    <div
      role="listbox"
      aria-label="Symbols in scan"
      className="flex flex-col gap-0.5 rounded-control bg-bg-input p-1"
    >
      {groups.map((g) => {
        const active = g.symbol === sel;
        const done = logged.has(g.symbol);
        const meta = [
          g.instrument === "option" ? g.contractLabel || "Option" : "Stock",
          g.side ? g.side : null,
          qtySummary(g),
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <button
            key={g.symbol}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => !readOnly && onSelect(g.symbol)}
            disabled={readOnly}
            className={cn(
              "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left",
              "border-none outline-none transition-colors duration-100",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
              active ? "bg-bg-hover" : "bg-transparent hover:bg-bg-hover",
              done && !active && "opacity-55",
              readOnly && "cursor-default hover:bg-transparent",
            )}
          >
            <span className="min-w-[4.5rem] text-[13px] font-semibold tracking-tight text-accent">
              {g.symbol}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-text-muted">{meta}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-text-dim">
              {g.fillCount} {g.fillCount === 1 ? "fill" : "fills"}
            </span>
            {done ? (
              <Check
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-profit"
                aria-label="Logged"
              />
            ) : (
              <span className="size-3.5 shrink-0" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
