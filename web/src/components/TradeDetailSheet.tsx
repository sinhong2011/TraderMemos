import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
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
import { cn } from "../lib/cn";
import type { TradeDetail } from "../lib/api/types";
import { fmtMoney, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { useTradeDetail } from "../lib/hooks/useTradeDetail";
import { computeRiskReward } from "../lib/riskReward";

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
              <button
                type="button"
                onClick={() => {
                  void navigate({ to: "/trades/$id", params: { id: tradeId } });
                  onClose();
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-control px-2 py-1 text-xs text-accent transition-colors hover:bg-accent-bg"
              >
                <ExternalLink size={12} strokeWidth={1.5} />
                Open full page
              </button>
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
              <Skeleton height="72px" />
              <Skeleton height="120px" />
              <Skeleton height="96px" />
            </div>
          )}
          {detailQ.isError && (
            <p className="p-4 text-sm text-text-muted">Could not load trade detail.</p>
          )}
          {detailQ.data && <TradeDetailSheetBody trade={detailQ.data} />}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-sm tabular-nums text-text">{value}</span>
    </div>
  );
}

function TradeDetailSheetBody({ trade }: { trade: TradeDetail }) {
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
        {pnl != null && (
          <p className={cn("mt-3 tabular-nums", heroPnlClass(pnl))}>
            {fmtSignedMoney(pnl, currency, intlLocale())}
            {trade.return_pct != null && (
              <span className={cn("ml-2 text-sm font-semibold", pnlColor(trade.return_pct))}>
                {trade.return_pct >= 0 ? "+" : ""}
                {trade.return_pct.toFixed(2)}%
              </span>
            )}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <MetaStat label="Entry" value={fmtMoney(trade.avg_entry_price, currency, intlLocale())} />
          <MetaStat
            label="Exit"
            value={
              trade.avg_exit_price != null
                ? fmtMoney(trade.avg_exit_price, currency, intlLocale())
                : "—"
            }
          />
          <MetaStat label="Qty" value={qty.toFixed(2)} />
          <MetaStat label="Hold" value={hold === "-" ? "—" : hold} />
        </div>
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
          <ul className="flex flex-col gap-2">
            {trade.fills.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 text-xs tabular-nums text-text"
              >
                <span className={f.side === "buy" ? "text-profit" : "text-loss"}>
                  {f.side.toUpperCase()} {f.quantity} @ {fmtMoney(f.price, currency, intlLocale())}
                </span>
                <span className="text-text-muted">
                  {new Date(f.executed_at).toLocaleString(intlLocale(), {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
