import { Check, ScanText } from "lucide-react";
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./Collapsible";
import { cn } from "../lib/cn";
import type { OcrSymbolGroup } from "../lib/ocrSymbolGroups";
import { partitionOcrWarnings } from "../lib/ocrSymbolGroups";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "./ui/item";

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function qtyLabel(g: OcrSymbolGroup): string | null {
  const parts: string[] = [];
  if (g.buyQty > 0) parts.push(`${formatQty(g.buyQty)}B`);
  if (g.sellQty > 0) parts.push(`${formatQty(g.sellQty)}S`);
  return parts.length > 0 ? parts.join(" / ") : null;
}

function contractLine(g: OcrSymbolGroup): string {
  if (g.instrument === "option") return g.contractLabel || "Option";
  return "Stock";
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
    <ItemGroup
      role="listbox"
      aria-label="Symbols in scan"
      className="gap-1"
      data-testid="ocr-symbol-group-list"
    >
      {groups.map((g, index) => {
        const active = g.symbol === sel;
        const done = logged.has(g.symbol);

        return (
          <Item
            key={g.symbol}
            size="sm"
            variant={active ? "muted" : "default"}
            render={
              <button
                type="button"
                role="option"
                aria-selected={active}
                disabled={readOnly}
                onClick={() => !readOnly && onSelect(g.symbol)}
              />
            }
            className={cn(
              "text-left",
              active && "bg-accent-bg hover:bg-accent-bg",
              !active && "bg-bg-elevated hover:bg-bg-hover",
              done && !active && "opacity-55",
              readOnly && "cursor-default hover:bg-bg-elevated disabled:opacity-100",
            )}
          >
            <ItemMedia
              variant="icon"
              className={cn(
                "size-6 text-[11px] font-semibold tabular-nums",
                active ? "bg-accent/20 text-accent" : "bg-bg-hover text-text-dim",
              )}
              aria-hidden
            >
              {index + 1}
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="text-accent">{g.symbol}</ItemTitle>
              <ItemDescription className="line-clamp-1">
                {contractLine(g)}
                <span className="text-text-dim"> · </span>
                <span
                  className={cn(
                    "font-semibold uppercase tracking-[0.06em]",
                    g.side === "long" && "text-profit",
                    g.side === "short" && "text-loss",
                    !g.side && "text-text-dim",
                  )}
                >
                  {g.side || "—"}
                </span>
                <span className="text-text-dim"> · </span>
                <span className="tabular-nums text-text-muted">{qtyLabel(g) ?? "—"}</span>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="tabular-nums text-[12px] font-medium text-text">
                {g.fillCount}
                <span className="ml-1 text-[11px] font-normal text-text-dim">
                  {g.fillCount === 1 ? "fill" : "fills"}
                </span>
              </span>
              {done ? (
                <Check
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 text-profit"
                  aria-label="Logged"
                />
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}

/** Post-scan summary: one collapsible block for symbols + extraction notes. */
export function OcrScanSummary({
  groups,
  warnings,
}: {
  groups: OcrSymbolGroup[];
  warnings: string[];
}) {
  const totalFills = groups.reduce((sum, g) => sum + g.fillCount, 0);
  const { headline, highlights, details } = partitionOcrWarnings(warnings);
  const noteCount = highlights.length + details.length;

  if (groups.length === 0 && warnings.length === 0) return null;

  const summaryBits = [
    groups.length > 0 ? `${groups.length} symbol${groups.length === 1 ? "" : "s"}` : null,
    totalFills > 0 ? `${totalFills} fill${totalFills === 1 ? "" : "s"}` : null,
    noteCount > 0 ? `${noteCount} note${noteCount === 1 ? "" : "s"}` : null,
    headline ? headline.replace(/\.$/, "") : null,
  ].filter(Boolean);

  return (
    <Collapsible
      defaultOpen={false}
      className="overflow-hidden rounded-control bg-bg-panel"
      data-testid="ocr-scan-summary"
    >
      <CollapsibleTrigger
        className={cn(
          "w-full gap-2.5 px-3.5 py-2.5",
          "hover:bg-transparent focus-visible:outline-offset-[-2px]",
        )}
        aria-label="Scan info"
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-control",
            "bg-bg-elevated text-signal transition-colors duration-150",
            "group-hover/collapsible-trigger:bg-accent-bg group-hover/collapsible-trigger:text-accent",
          )}
        >
          <ScanText size={14} strokeWidth={1.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[11px] font-semibold uppercase tracking-widest text-signal",
              "transition-colors duration-150 group-hover/collapsible-trigger:text-accent",
            )}
          >
            Scan info
          </span>
          {summaryBits.length > 0 ? (
            <span
              className={cn(
                "mt-0.5 block truncate text-[11px] leading-snug text-text-dim",
                "transition-colors duration-150 group-hover/collapsible-trigger:text-text-muted",
              )}
            >
              {summaryBits.join(" · ")}
            </span>
          ) : null}
        </span>
        <CollapsibleChevron className="transition-colors duration-150 group-hover/collapsible-trigger:text-text" />
      </CollapsibleTrigger>

      <CollapsibleContent animation="height">
        <div
          className="flex flex-col gap-2.5 px-2.5 pb-2.5 pt-0.5"
          aria-label="Symbols loaded from scan"
        >
          {groups.length > 0 ? (
            <OcrSymbolGroupList
              groups={groups}
              selected=""
              logged={new Set()}
              onSelect={() => {}}
              readOnly
            />
          ) : null}

          {noteCount > 0 ? (
            <div
              className="flex flex-col gap-2 rounded-control bg-bg-inset/60 px-3 py-2.5"
              data-testid="ocr-warnings"
            >
              <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
                Extraction notes
                <span className="ml-1.5 tabular-nums">({noteCount})</span>
              </p>
              {highlights.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {highlights.map((w) => (
                    <li
                      key={w}
                      className="rounded-control bg-[rgba(228,255,26,0.06)] px-2.5 py-1.5 text-[11px] leading-snug text-signal"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
              {details.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {details.map((w) => (
                    <li
                      key={w}
                      className="text-[11px] leading-snug text-text-dim before:mr-1.5 before:text-text-dim before:content-['·']"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
