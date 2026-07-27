import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import type { BatchTradePnlPreview, TradePnlPreview } from "@/lib/tradePnlPreview";
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
        "flex min-w-0 flex-col gap-2 rounded-lg bg-sidebar px-3 py-3",
        className,
      )}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="text-[15px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
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
    // Container-driven: this sits inside a symbol card *and* at drawer level, so
    // its own width — not the viewport — decides whether the bento fits four up.
    <div
      className={cn("flex flex-col gap-2 @container/result", className)}
      data-testid="trade-result-preview"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-chart-3">
          Result
        </p>
        {initialRisk != null && initialRisk > 0 ? (
          <p className="m-0 text-[10px] tabular-nums text-muted-foreground">
            Risk {fmtMoney(initialRisk, currency, locale)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 @min-[32rem]/result:grid-cols-4">
        <BentoCell label="Avg Entry">{money(preview.avgEntry)}</BentoCell>
        <BentoCell label="Avg Exit">{money(preview.avgExit)}</BentoCell>
        <BentoCell label="Est. P&L">
          {preview.net == null ? (
            <span className="text-muted-foreground">—</span>
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
                <span className="ml-1.5 align-baseline text-[11px] font-medium text-muted-foreground">
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
  /** Account net P&L before this batch (header / summary scope). */
  accountNetPnl?: number | null;
  /** Estimated cash before this batch (starting + flows + realized). */
  accountCash?: number | null;
  className?: string;
}

function BatchMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-[13px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {children}
      </div>
    </div>
  );
}

/** Batch totals across every symbol in a multi-trade Save. */
export function BatchTradeResultPreview({
  batch,
  currency,
  locale,
  accountNetPnl,
  accountCash,
  className,
}: BatchTradeResultPreviewProps) {
  if (batch.withFills === 0 && batch.net == null) return null;

  const batchDelta = batch.net ?? 0;
  const hasAccountBaseline = accountNetPnl != null || accountCash != null;
  const extTotal = accountNetPnl != null ? accountNetPnl + batchDelta : null;
  const cashAfter = accountCash != null ? accountCash + batchDelta : null;
  const allClosed = batch.openCount === 0 && batch.closedCount > 0;

  return (
    <div
      className={cn("flex flex-col gap-3 @container/batch", className)}
      data-testid="batch-trade-result-preview"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-chart-3">
          Batch result
        </p>
        {batch.riskTotal != null && batch.riskTotal > 0 ? (
          <p className="m-0 text-[10px] tabular-nums text-muted-foreground">
            Risk {fmtMoney(batch.riskTotal, currency, locale)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 @min-[32rem]/batch:flex-row @min-[32rem]/batch:items-end @min-[32rem]/batch:justify-between @min-[32rem]/batch:gap-6">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-medium tracking-[0.04em] text-muted-foreground">
            Est. P&L
          </p>
          {batch.net == null ? (
            <p className="mt-1.5 m-0 text-[26px] font-semibold leading-none tracking-[-0.04em] text-muted-foreground">
              —
            </p>
          ) : (
            <p
              className={cn(
                "mt-1.5 m-0 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums",
                pnlColor(batch.net),
                batch.net > 0 && "drop-shadow-[0_0_28px_rgba(74,222,128,0.35)]",
                batch.net < 0 && "drop-shadow-[0_0_28px_rgba(251,113,133,0.28)]",
              )}
            >
              {fmtSignedMoney(batch.net, currency, locale)}
              {batch.rMultiple != null ? (
                <span className="ml-2 align-baseline text-[12px] font-medium tracking-normal text-muted-foreground">
                  {batch.rMultiple.toFixed(2)}R
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-x-5 gap-y-2.5 @min-[32rem]/batch:justify-end">
          <BatchMeta label="Symbols">
            <span>
              {batch.symbolCount}
              <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                {batch.openCount === 0 ? "closed" : `${batch.closedCount}c · ${batch.openCount}o`}
              </span>
            </span>
          </BatchMeta>
          <BatchMeta label="Fees">{fmtMoney(batch.feesTotal, currency, locale)}</BatchMeta>
          <BatchMeta label="Closed">
            {allClosed ? (
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
          </BatchMeta>
        </div>
      </div>

      {hasAccountBaseline ? (
        <div
          className={cn(
            "flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md px-3 py-2.5",
            extTotal != null && extTotal > 0 && "bg-profit/10",
            extTotal != null && extTotal < 0 && "bg-destructive/10",
            (extTotal == null || extTotal === 0) && "bg-sidebar",
          )}
          data-testid="batch-ext-total"
        >
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              After save
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[11px] text-muted-foreground">Account P&L</span>
              {extTotal == null ? (
                <span className="text-[15px] font-semibold text-muted-foreground">—</span>
              ) : (
                <span
                  className={cn(
                    "text-[15px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
                    pnlColor(extTotal),
                    extTotal > 0 && "drop-shadow-[0_0_16px_rgba(74,222,128,0.28)]",
                    extTotal < 0 && "drop-shadow-[0_0_16px_rgba(251,113,133,0.22)]",
                  )}
                >
                  {fmtSignedMoney(extTotal, currency, locale)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cash
            </span>
            <span className="text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
              {cashAfter == null ? "—" : fmtMoney(cashAfter, currency, locale)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
