import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtMoney, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./Drawer";
import { EmptyState } from "./EmptyState";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "./Item";
import { Pill } from "./Pill";
import { Skeleton } from "./Skeleton";
import { marketLabel, tradeStatus } from "./tradeColumns";
import { TradeRowMenu } from "./TradeRowMenu";
import { pnlColor } from "./theme-tokens";
import { WinLossRecord } from "./WinLossRecord";
import { resolveTradeDirection } from "@/lib/tradeDirection";

function formatDayTitle(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(intlLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function summarizeDayTrades(trades: Trade[]): {
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
} {
  let pnl = 0;
  let wins = 0;
  let losses = 0;
  for (const t of trades) {
    const net = t.net_pnl;
    if (net == null || Number.isNaN(net)) continue;
    pnl += net;
    if (net > 0) wins += 1;
    else if (net < 0) losses += 1;
  }
  const decided = wins + losses;
  return {
    pnl: Math.round(pnl * 100) / 100,
    trades: trades.length,
    wins,
    losses,
    winRate: decided > 0 ? wins / decided : null,
  };
}

function DaySummary({
  trades,
  currency,
  fxRate = 1,
}: {
  trades: Trade[];
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const summary = summarizeDayTrades(trades);
  const winRateLabel = summary.winRate != null ? `${(summary.winRate * 100).toFixed(1)}%` : null;

  return (
    <div className="px-4 pb-3 pt-1">
      <p
        className={cn(
          "text-[22px] font-semibold tabular-nums tracking-tight",
          pnlColor(summary.pnl),
        )}
      >
        {fmtSignedMoney(summary.pnl * fxRate, currency, locale)}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] tabular-nums text-muted-foreground">
        <span>
          {summary.trades} {summary.trades === 1 ? "trade" : "trades"}
        </span>
        {(summary.wins > 0 || summary.losses > 0) && (
          <>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <WinLossRecord wins={summary.wins} losses={summary.losses} />
            {winRateLabel ? <span className="text-muted-foreground">· {winRateLabel}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

function tradeCardMeta(trade: Trade, currency: string, fxRate = 1): string {
  const qty = trade.qty_opened.toFixed(trade.qty_opened % 1 === 0 ? 0 : 2);
  const entry = fmtMoney(trade.avg_entry_price * fxRate, currency, intlLocale());
  const exit =
    trade.avg_exit_price != null
      ? fmtMoney(trade.avg_exit_price * fxRate, currency, intlLocale())
      : "—";
  const hold = fmtDuration(trade.time_in_trade_secs);
  const holdPart = hold === "-" ? null : hold;
  return [qty, `${entry} → ${exit}`, holdPart].filter(Boolean).join(" · ");
}

function DayTradeItem({
  trade,
  currency,
  fxRate = 1,
  onSelectTrade,
  onOpenFullPage,
  onFilterSymbol,
  onDeleted,
}: {
  trade: Trade;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
  onOpenFullPage: (t: Trade) => void;
  onFilterSymbol?: (symbol: string) => void;
  onDeleted?: (t: Trade) => void;
}) {
  usePrivacyMode();
  const status = tradeStatus(trade);
  const dir = resolveTradeDirection({
    direction: trade.direction,
    instrumentType: trade.instrument_type,
    symbol: trade.symbol,
  });
  const isLong = dir.long;
  const DirIcon = dir.arrowUp ? ArrowUpRight : ArrowDownRight;
  const dirTone =
    dir.tone === "profit"
      ? "bg-profit/10 text-profit"
      : dir.tone === "loss"
        ? "bg-destructive/10 text-destructive"
        : isLong
          ? "bg-profit/10 text-profit"
          : "bg-destructive/10 text-destructive";

  return (
    <Item
      variant="default"
      size="default"
      className={cn(
        "w-full cursor-pointer gap-3 border-transparent bg-accent px-3.5 py-3",
        "hover:bg-card focus-visible:bg-card",
      )}
      tabIndex={0}
      onClick={() => onSelectTrade(trade)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectTrade(trade);
        }
      }}
    >
      <ItemMedia variant="icon" aria-hidden className={cn("size-9 self-center", dirTone)}>
        <DirIcon size={16} strokeWidth={2} aria-label={dir.label} />
      </ItemMedia>
      <ItemContent className="gap-1">
        <ItemTitle className="gap-2 text-[15px]">
          <span className="font-semibold tracking-tight text-primary">{trade.symbol}</span>
          <Pill tone={status.tone} title={status.label === "BE" ? "Break-even" : undefined}>
            {status.label}
          </Pill>
          {dir.tag && dir.tag !== "?" ? (
            <span
              className={cn(
                "text-[11px] font-semibold tracking-wide",
                dir.tone === "profit"
                  ? "text-profit"
                  : dir.tone === "loss"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
              title={dir.label}
            >
              {dir.tag}
            </span>
          ) : null}
          <span className="text-[12px] font-medium tracking-wide text-muted-foreground">
            {marketLabel(trade.instrument_type)}
          </span>
        </ItemTitle>
        <ItemDescription className="text-[13px] text-muted-foreground">
          {tradeCardMeta(trade, currency, fxRate)}
        </ItemDescription>
      </ItemContent>
      <ItemContent className="items-end gap-0.5 text-right">
        {trade.net_pnl != null ? (
          <>
            <ItemTitle
              className={cn("text-[15px] font-semibold tabular-nums", pnlColor(trade.net_pnl))}
            >
              {fmtSignedMoney(trade.net_pnl * fxRate, currency, intlLocale())}
            </ItemTitle>
            {trade.return_pct != null && (
              <ItemDescription
                className={cn("text-[13px] tabular-nums", pnlColor(trade.return_pct))}
              >
                {trade.return_pct >= 0 ? "+" : ""}
                {trade.return_pct.toFixed(2)}%
              </ItemDescription>
            )}
          </>
        ) : (
          <ItemTitle className="text-[15px] text-muted-foreground">—</ItemTitle>
        )}
      </ItemContent>
      <ItemActions
        className="self-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <TradeRowMenu
          trade={trade}
          actions={{
            onOpenDrawer: onSelectTrade,
            onOpenFullPage,
            onFilterSymbol,
            onDeleted,
          }}
        />
      </ItemActions>
    </Item>
  );
}

export interface DayTradesDrawerProps {
  selectedDay: string | null;
  onClose: () => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
  onOpenFullPage: (t: Trade) => void;
  onFilterSymbol?: (symbol: string) => void;
  onDeleted?: (t: Trade) => void;
}

export function DayTradesDrawer({
  selectedDay,
  onClose,
  dayTrades,
  dayTradesLoading,
  dayTradesError,
  currency,
  fxRate = 1,
  onSelectTrade,
  onOpenFullPage,
  onFilterSymbol,
  onDeleted,
}: DayTradesDrawerProps) {
  const open = Boolean(selectedDay);
  const title = selectedDay ? `Trades — ${formatDayTitle(selectedDay)}` : "Day trades";

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent className="[--drawer-content-width:min(440px,calc(100vw-2*var(--drawer-inset)))]">
        <DrawerHeader className="px-4 py-3">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer rounded-md border-none bg-transparent p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody className="gap-0 p-0">
          {dayTradesLoading ? (
            <Skeleton height="160px" className="m-4" />
          ) : dayTradesError ? (
            <p className="p-4 text-xs text-destructive">Failed to load trades.</p>
          ) : dayTrades.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No trades on this day" />
            </div>
          ) : (
            <>
              <DaySummary trades={dayTrades} currency={currency} fxRate={fxRate} />
              <ItemGroup className="gap-2 px-4 pb-4">
                {dayTrades.map((trade) => (
                  <DayTradeItem
                    key={trade.id}
                    trade={trade}
                    currency={currency}
                    fxRate={fxRate}
                    onSelectTrade={onSelectTrade}
                    onOpenFullPage={onOpenFullPage}
                    onFilterSymbol={onFilterSymbol}
                    onDeleted={onDeleted}
                  />
                ))}
              </ItemGroup>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
