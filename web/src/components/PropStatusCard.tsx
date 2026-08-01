import type { Account } from "@/lib/api/types";
import { usePropStatus } from "@/lib/hooks/useProp";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { displayTz } from "@/lib/filters";
import { fmtMoney, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { Pill } from "./Pill";
import { StatCard } from "./StatCard";

export interface PropStatusCardProps {
  accounts: Account[];
  selectedAccountId?: string;
}

function RuleBar({
  label,
  value,
  max,
  danger,
  note,
}: {
  label: string;
  value: number; // 0..1 progress
  max?: boolean; // true = filling up is good (target); false = filling up is bad
  danger?: boolean;
  note: string;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{note}</span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-muted/60">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
            danger ? "bg-destructive" : max ? "bg-profit" : "bg-chart-3",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

/**
 * Funded-account guardrails: profit-target progress and distance to the
 * drawdown floor, evaluated server-side against the account's prop rules.
 * Renders only when a single prop account is selected and has rules saved.
 */
export function PropStatusCard({ accounts, selectedAccountId }: PropStatusCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const account = accounts.find((a) => a.id === selectedAccountId);
  const isProp = account?.account_type === "prop";
  const statusQ = usePropStatus(account?.id, displayTz(), isProp);

  if (!isProp || !statusQ.data?.configured || !statusQ.data.status) return null;
  const st = statusQ.data.status;
  const currency = account.base_currency;

  return (
    <Card title="Prop program">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard label="Equity" value={fmtMoney(st.equity, currency, locale)} />
          <StatCard
            label="Realized P&L"
            value={fmtSignedMoney(st.realized_pnl, currency, locale)}
            accent={st.realized_pnl >= 0 ? "pos" : "neg"}
          />
          <StatCard label="Trading days" value={String(st.trading_days)} />
          <StatCard
            label="Best day"
            value={fmtSignedMoney(st.best_day_pnl, currency, locale)}
            hint={
              st.best_day_share != null
                ? `${(st.best_day_share * 100).toFixed(0)}% of profit`
                : undefined
            }
          />
        </div>

        <div className="flex max-w-2xl flex-col gap-3">
          {st.profit_target != null && st.profit_target > 0 && (
            <RuleBar
              label="Profit target"
              value={st.target_pct ?? 0}
              max
              note={`${fmtSignedMoney(st.realized_pnl, currency, locale)} of ${fmtMoney(st.profit_target, currency, locale)}`}
            />
          )}
          {st.max_drawdown != null && st.max_drawdown > 0 && st.floor_distance != null && (
            <RuleBar
              label={`Drawdown (${st.drawdown_mode ?? "trailing"})`}
              value={1 - st.floor_distance / st.max_drawdown}
              danger={st.drawdown_hit || st.floor_distance <= st.max_drawdown * 0.25}
              note={`${fmtMoney(st.floor_distance, currency, locale)} above the floor`}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {st.target_reached && <Pill tone="pos">target reached</Pill>}
          {st.drawdown_hit && <Pill tone="neg">drawdown floor hit</Pill>}
          {st.daily_loss_hits > 0 && <Pill tone="neg">daily loss ×{st.daily_loss_hits}</Pill>}
          {st.consistency_ok === false && <Pill tone="amber">consistency rule at risk</Pill>}
          {st.consistency_ok === true && <Pill tone="pos">consistency ok</Pill>}
        </div>
      </div>
    </Card>
  );
}
