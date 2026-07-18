import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { fmtMoney, fmtSignedMoney } from "../lib/format";
import type { BatchTradePnlPreview, TradePnlPreview } from "../lib/tradePnlPreview";
import { pnlColor } from "./theme-tokens";

export interface TradeResultPreviewProps {
  preview: TradePnlPreview;
  currency: string;
  locale: string;
  /** Optional planned risk shown as a quiet footnote. */
  initialRisk?: number | null;
  className?: string;
}

function BentoCell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        // Lift above both drawer panel and symbol-card hover surfaces.
        "flex min-w-0 flex-col gap-2 rounded-card bg-bg-elevated px-3 py-3",
        className,
      )}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <div className="text-[15px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-text">
        {children}
      </div>
    </section>
  );
}

/** One-row bento: Avg Entry / Exit / Est. P&L / Position for Log Trade. */
export function TradeResultPreview({
  preview,
  currency,
  locale,
  initialRisk,
  className,
}: TradeResultPreviewProps) {
  const hasEntry = preview.avgEntry != null;
  if (!hasEntry && preview.net == null) return null;

  const money = (v: number | null) => (v == null ? "—" : fmtMoney(v, currency, locale));

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="trade-result-preview">
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-signal">
          Result
        </p>
        {initialRisk != null && initialRisk > 0 ? (
          <p className="m-0 text-[10px] tabular-nums text-text-dim">
            Risk {fmtMoney(initialRisk, currency, locale)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BentoCell label="Avg Entry">{money(preview.avgEntry)}</BentoCell>
        <BentoCell label="Avg Exit">{money(preview.avgExit)}</BentoCell>
        <BentoCell label="Est. P&L">
          {preview.net == null ? (
            <span className="text-text-dim">—</span>
          ) : (
            <span
              className={cn(
                pnlColor(preview.net),
                preview.net > 0 && "drop-shadow-[0_0_18px_rgba(74,222,128,0.28)]",
                preview.net < 0 && "drop-shadow-[0_0_18px_rgba(251,113,133,0.22)]",
              )}
            >
              {fmtSignedMoney(preview.net, currency, locale)}
              {preview.rMultiple != null ? (
                <span className="ml-1.5 align-baseline text-[11px] font-medium text-text-muted">
                  {preview.rMultiple.toFixed(2)}R
                </span>
              ) : null}
            </span>
          )}
        </BentoCell>
        <BentoCell label="Position">
          {preview.closed ? (
            <span className="inline-flex items-center gap-1.5 text-profit">
              <span>0</span>
              <span
                className="inline-flex size-4 items-center justify-center rounded-full bg-profit/15"
                aria-label="Closed"
              >
                <Check size={11} strokeWidth={2.75} aria-hidden />
              </span>
            </span>
          ) : (
            <span>{preview.positionQty}</span>
          )}
        </BentoCell>
      </div>
    </div>
  );
}

export interface BatchTradeResultPreviewProps {
  batch: BatchTradePnlPreview;
  currency: string;
  locale: string;
  className?: string;
}

/** Batch totals across every symbol in a multi-trade Save. */
export function BatchTradeResultPreview({
  batch,
  currency,
  locale,
  className,
}: BatchTradeResultPreviewProps) {
  if (batch.withFills === 0 && batch.net == null) return null;

  const closedLabel =
    batch.openCount === 0
      ? `${batch.closedCount} closed`
      : `${batch.closedCount} closed · ${batch.openCount} open`;

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="batch-trade-result-preview">
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-signal">
          Batch result
        </p>
        {batch.riskTotal != null && batch.riskTotal > 0 ? (
          <p className="m-0 text-[10px] tabular-nums text-text-dim">
            Risk {fmtMoney(batch.riskTotal, currency, locale)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BentoCell label="Symbols">
          <span>
            {batch.symbolCount}
            <span className="ml-1.5 text-[11px] font-medium text-text-muted">{closedLabel}</span>
          </span>
        </BentoCell>
        <BentoCell label="Fees">{fmtMoney(batch.feesTotal, currency, locale)}</BentoCell>
        <BentoCell label="Est. P&L">
          {batch.net == null ? (
            <span className="text-text-dim">—</span>
          ) : (
            <span
              className={cn(
                pnlColor(batch.net),
                batch.net > 0 && "drop-shadow-[0_0_18px_rgba(74,222,128,0.28)]",
                batch.net < 0 && "drop-shadow-[0_0_18px_rgba(251,113,133,0.22)]",
              )}
            >
              {fmtSignedMoney(batch.net, currency, locale)}
              {batch.rMultiple != null ? (
                <span className="ml-1.5 align-baseline text-[11px] font-medium text-text-muted">
                  {batch.rMultiple.toFixed(2)}R
                </span>
              ) : null}
            </span>
          )}
        </BentoCell>
        <BentoCell label="Closed">
          {batch.openCount === 0 && batch.closedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-profit">
              <span>
                {batch.closedCount}/{batch.symbolCount}
              </span>
              <span
                className="inline-flex size-4 items-center justify-center rounded-full bg-profit/15"
                aria-label="All closed"
              >
                <Check size={11} strokeWidth={2.75} aria-hidden />
              </span>
            </span>
          ) : (
            <span>
              {batch.closedCount}/{batch.symbolCount}
            </span>
          )}
        </BentoCell>
      </div>
    </div>
  );
}
