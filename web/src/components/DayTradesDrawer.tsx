import { X } from "lucide-react";
import type { Trade } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtSignedMoney } from "@/lib/format";
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
import { ItemGroup } from "./Item";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import { TradeListItem } from "./TradeListItem";
import { WinLossRecord } from "./WinLossRecord";

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

export interface DayTradesDrawerProps {
  selectedDay: string | null;
  onClose: () => void;
  dayTrades: Trade[];
  dayTradesLoading: boolean;
  dayTradesError: boolean;
  currency: string;
  fxRate?: number;
  onSelectTrade: (t: Trade) => void;
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
                  <TradeListItem
                    key={trade.id}
                    trade={trade}
                    currency={currency}
                    fxRate={fxRate}
                    onSelect={onSelectTrade}
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
