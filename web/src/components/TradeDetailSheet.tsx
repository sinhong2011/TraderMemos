import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, X, Zap } from "lucide-react";
import { TradeChartSection } from "./charts/TradeChartSection";
import { RiskRewardPanel } from "./RiskRewardPanel";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./Drawer";
import { Skeleton } from "./Skeleton";
import { Pill } from "./Pill";
import { heroPnlClass, pnlColor } from "./theme-tokens";
import { marketLabel, tradeStatus } from "./tradeColumns";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";
import type { TradeDetail } from "../lib/api/types";
import { fmtMoney, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { useTradeDetail } from "../lib/hooks/useTradeDetail";
import { computeRiskReward } from "../lib/riskReward";
import { usePrivacyMode } from "../lib/displayPrefs";

export interface TradeDetailSheetProps {
  tradeId: string | null;
  onClose: () => void;
}

const sectionLabelClass = "mb-2 text-[10px] font-semibold uppercase tracking-widest text-signal";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TradeDetailSheet({ tradeId, onClose }: TradeDetailSheetProps) {
  const navigate = useNavigate();
  const open = Boolean(tradeId);
  const detailQ = useTradeDetail(tradeId ?? "");

  const openFullPage = () => {
    if (!tradeId) return;
    void navigate({ to: "/trades/$id", params: { id: tradeId } });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent>
        <DrawerHeader className="px-4 py-3">
          <DrawerTitle className="flex items-baseline gap-1.5">
            {detailQ.data ? (
              <>
                {detailQ.data.symbol}
                <span className="text-xs font-medium text-text-muted">
                  · {marketLabel(detailQ.data.instrument_type)} ·{" "}
                  {detailQ.data.direction.toUpperCase()}
                </span>
              </>
            ) : (
              "Trade"
            )}
          </DrawerTitle>
          <div className="ml-auto flex items-center gap-1">
            {tradeId && (
              <Button
                type="button"
                variant="soft"
                size="xs"
                onClick={openFullPage}
                className="gap-1.5"
              >
                <ExternalLink size={12} strokeWidth={1.5} />
                Open full page
              </Button>
            )}
            <DrawerClose
              aria-label="Close"
              className="flex cursor-pointer rounded-control border-none bg-transparent p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
            >
              <X size={18} strokeWidth={1.5} />
            </DrawerClose>
          </div>
        </DrawerHeader>
        <DrawerBody className="gap-0 p-0">
          {detailQ.isLoading && (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton height="24px" width="60%" />
              <Skeleton height="140px" />
              <Skeleton height="200px" />
              <Skeleton height="72px" />
            </div>
          )}
          {detailQ.isError && (
            <p className="p-4 text-sm text-text-muted">Could not load trade detail.</p>
          )}
          {detailQ.data && (
            <TradeDetailSheetBody trade={detailQ.data} onOpenFullPage={openFullPage} />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function BentoStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-bg-elevated p-2.5 sm:p-3", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="truncate text-sm tabular-nums whitespace-nowrap text-text" title={value}>
        {value}
      </span>
    </div>
  );
}

function TradeDetailSheetBody({
  trade,
  onOpenFullPage,
}: {
  trade: TradeDetail;
  onOpenFullPage: () => void;
}) {
  usePrivacyMode();
  const currency = trade.pnl_currency;
  const pnl = trade.net_pnl;
  const status = tradeStatus(trade);
  const hold = computeRiskReward(trade).holdLabel;
  const qty =
    trade.status === "open" && trade.qty_remaining > 0 ? trade.qty_remaining : trade.qty_opened;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill tone={status.tone} title={status.label === "BE" ? "Break-even" : undefined}>
            {status.label}
          </Pill>
          <span className="text-xs tabular-nums text-text-muted">
            {trade.status === "open"
              ? `${fmtWhen(trade.opened_at)} · still open`
              : `${fmtWhen(trade.opened_at)} → ${
                  trade.closed_at ? fmtWhen(trade.closed_at) : "—"
                }${hold === "-" ? "" : ` · ${hold}`}`}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-px overflow-hidden rounded-sharp bg-border">
          <div className="row-span-2 flex flex-col justify-between gap-3 bg-bg-elevated p-3.5">
            <div>
              {pnl != null ? (
                <>
                  <p
                    className={cn(
                      "m-0 tabular-nums",
                      heroPnlClass(pnl),
                      pnl > 0 && "hero-glow-profit",
                      pnl < 0 && "hero-glow-loss",
                    )}
                  >
                    {fmtSignedMoney(pnl, currency, intlLocale())}
                  </p>
                  <p className="mt-1.5 mb-0 text-sm font-semibold tabular-nums">
                    {trade.return_pct != null && (
                      <span className={pnlColor(trade.return_pct)}>
                        {trade.return_pct >= 0 ? "+" : ""}
                        {trade.return_pct.toFixed(2)}%
                      </span>
                    )}
                    {trade.r_multiple != null && (
                      <span className={cn("ml-2", pnlColor(trade.r_multiple))}>
                        {trade.r_multiple >= 0 ? "+" : ""}
                        {trade.r_multiple.toFixed(2)}R
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <p className="m-0 text-[32px] font-semibold leading-none text-flat">—</p>
              )}
            </div>
            {trade.gross_pnl != null && (
              <p className="m-0 text-[10px] tabular-nums text-text-dim">
                {fmtSignedMoney(trade.gross_pnl, currency, intlLocale())} gross −{" "}
                {fmtMoney(trade.fees_total, currency, intlLocale())} fees
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-px">
            <BentoStat
              label="Entry"
              value={fmtMoney(trade.avg_entry_price, currency, intlLocale())}
            />
            <BentoStat
              label="Exit"
              value={
                trade.avg_exit_price != null
                  ? fmtMoney(trade.avg_exit_price, currency, intlLocale())
                  : "—"
              }
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.75rem,1.35fr)_minmax(0,1fr)] gap-px">
            <BentoStat label="Qty" value={qty.toFixed(2)} />
            <BentoStat label="Hold" value={hold === "-" ? "—" : hold} />
            <BentoStat label="Fees" value={fmtMoney(trade.fees_total, currency, intlLocale())} />
          </div>
        </div>
        {(trade.tags.length > 0 || trade.setup) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {trade.tags.map((t) => (
              <Pill key={t.id} tone="muted">
                {t.name}
              </Pill>
            ))}
            {trade.setup && (
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Zap size={14} strokeWidth={1.5} className="text-signal" />
                Setup: <span className="font-medium text-text">{trade.setup.name}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <RiskRewardPanel trade={trade} className="p-0" hideWhenEmpty />

      <div className="-mx-4">
        <TradeChartSection trade={trade} />
      </div>

      <section>
        <p className={sectionLabelClass}>Executions ({trade.fills.length})</p>
        {trade.fills.length === 0 ? (
          <p className="text-xs text-text-muted">No fills recorded.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {trade.fills.map((f) => (
              <li
                key={f.id}
                className="-mx-2 flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-xs tabular-nums transition-colors hover:bg-bg-hover"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-label={f.side === "buy" ? "Buy" : "Sell"}
                    className={cn(
                      "flex size-4 items-center justify-center rounded-control text-[10px] font-bold",
                      f.side === "buy" ? "bg-tint-pos text-profit" : "bg-tint-neg text-loss",
                    )}
                  >
                    {f.side === "buy" ? "B" : "S"}
                  </span>
                  <span className="text-text">
                    {f.quantity} @ {fmtMoney(f.price, currency, intlLocale())}
                  </span>
                  {f.fees + f.commission > 0 && (
                    <span className="text-text-dim">
                      {fmtMoney(f.fees + f.commission, currency, intlLocale())} fee
                    </span>
                  )}
                </span>
                <span className="text-text-muted">{fmtWhen(f.executed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trade.notes.trim() !== "" && (
        <section>
          <p className={sectionLabelClass}>Notes</p>
          <p className="m-0 line-clamp-3 text-sm whitespace-pre-wrap text-text-muted">
            {trade.notes}
          </p>
          <Button
            type="button"
            variant="link"
            onClick={onOpenFullPage}
            className="mt-1.5 h-auto text-xs"
          >
            Read more
          </Button>
        </section>
      )}
    </div>
  );
}
