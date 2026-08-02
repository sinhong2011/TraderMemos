import { useRiskRules } from "@/lib/hooks/useRiskRules";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export interface DailyLossCardProps {
  /** Today's realized net P&L in the account base currency. */
  todayNetPnl: number;
  currency: string;
  fxRate?: number;
}

/**
 * Session guardrail: how much of today's max-daily-loss budget is spent.
 * Renders nothing until a max daily loss is configured in Settings → Rules —
 * a tracker with no limit is just another P&L number.
 */
export function DailyLossCard({ todayNetPnl, currency, fxRate = 1 }: DailyLossCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const { data: rules } = useRiskRules();
  const limit = rules?.max_daily_loss ?? null;
  if (limit == null || limit <= 0) return null;

  const net = todayNetPnl * fxRate;
  const cap = limit * fxRate;
  const spent = net < 0 ? Math.min(-net, cap) : 0;
  const usedPct = net < 0 ? Math.min(100, (-net / cap) * 100) : 0;
  const breached = -net >= cap;
  const warning = !breached && usedPct >= 70;

  return (
    <Card title="Daily loss limit">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              net >= 0 ? "text-profit" : breached ? "text-destructive" : "text-foreground",
            )}
          >
            {fmtSignedMoney(net, currency, locale)}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            limit {fmtMoney(cap, currency, locale)}
          </span>
        </div>
        <span className="h-2 overflow-hidden rounded-full bg-muted/60">
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300",
              breached ? "bg-destructive" : warning ? "bg-chart-3" : "bg-primary/60",
            )}
            style={{ width: `${usedPct}%` }}
          />
        </span>
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
          {breached
            ? "Daily loss limit hit — flat is a position. Step away and journal the day."
            : net < 0
              ? `${fmtMoney(cap - spent, currency, locale)} of loss budget left today.`
              : "Loss budget untouched today."}
        </p>
      </div>
    </Card>
  );
}
