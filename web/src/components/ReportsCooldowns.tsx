import type { CooldownStats } from "@/lib/api/cooldown";
import { returnRuleLabel } from "@/lib/cooldown";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDuration, fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface ReportsCooldownsProps {
  stats?: CooldownStats;
  loading: boolean;
  error: boolean;
}

/**
 * "Do the cooldowns work?" — sessions over the range, and the one comparison
 * that answers it: trades opened within an hour of a release against trades
 * opened within an hour of a loss streak on days with no cooldown.
 */
export function ReportsCooldowns({ stats, loading, error }: ReportsCooldownsProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();

  if (loading) {
    return (
      <Card title="Cooldowns">
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Cooldowns">
        <p className="m-0 text-xs text-destructive">Failed to load cooldowns.</p>
      </Card>
    );
  }
  if (!stats || stats.sessions === 0) {
    return (
      <Card title="Cooldowns">
        <EmptyState
          title="No cooldowns in this range"
          hint="Start one from the Trades toolbar, or set Auto cooldown under Settings → Rules so a tripped limit starts it for you."
        />
      </Card>
    );
  }

  const after = stats.after_release;
  const without = stats.after_streak_no_cooldown;
  const rules = Object.entries(stats.by_rule)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${returnRuleLabel(key).toLowerCase()} ×${n}`)
    .join(" · ");

  return (
    <Card
      title="Cooldowns"
      description="Trades opened within an hour of a release, against trades opened within an hour of a loss streak on days you did not cool down."
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Cooldowns"
          value={String(stats.sessions)}
          hint={
            stats.early_releases > 0
              ? `${stats.early_releases} unlocked early`
              : `avg ${fmtDuration(stats.avg_minutes * 60)}`
          }
        />
        <StatCard
          label="After a cooldown"
          value={after.trades > 0 ? money.format(after.net_pnl) : "No trades"}
          hint={
            after.trades > 0
              ? `${after.trades} trades · ${fmtPct(after.win_rate, locale)} win`
              : "within an hour of unlocking"
          }
          accent={after.trades === 0 ? "none" : after.net_pnl >= 0 ? "pos" : "neg"}
        />
        <StatCard
          label={`After ${stats.streak_n} losses, no cooldown`}
          value={without.trades > 0 ? money.format(without.net_pnl) : "No trades"}
          hint={
            without.trades > 0
              ? `${without.trades} trades · ${fmtPct(without.win_rate, locale)} win`
              : "within an hour of the streak"
          }
          accent={without.trades === 0 ? "none" : without.net_pnl >= 0 ? "pos" : "neg"}
        />
        <StatCard
          label="Return rule broken"
          value={String(stats.return_rule_breaches)}
          hint={rules || "no rules made yet"}
          accent={stats.return_rule_breaches > 0 ? "neg" : "none"}
        />
      </div>
    </Card>
  );
}
