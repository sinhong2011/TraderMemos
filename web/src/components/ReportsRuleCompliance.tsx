import { Link } from "@tanstack/react-router";
import type { ComplianceReport } from "@/lib/api/types";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDayShort } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Pill } from "./Pill";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";

export interface ReportsRuleComplianceProps {
  report?: ComplianceReport;
  loading: boolean;
  error: boolean;
}

/**
 * "What do the rules cost me when I break them?" — compares P&L on days that
 * followed the risk rules against days that broke them, the single most
 * persuasive discipline chart a journal can show.
 */
export function ReportsRuleCompliance({ report, loading, error }: ReportsRuleComplianceProps) {
  usePrivacyMode();
  const money = useReportsMoney();
  const locale = intlLocale();

  if (loading) {
    return (
      <Card title="Rule compliance">
        <Skeleton height="160px" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card title="Rule compliance">
        <p className="m-0 text-xs text-destructive">Failed to load compliance.</p>
      </Card>
    );
  }
  if (!report?.rules_configured) {
    return (
      <Card title="Rule compliance">
        <EmptyState
          title="No risk rules configured"
          hint="Set max risk per trade and max daily loss in Settings → Rules to score every trading day against your own process."
        />
        <Link
          to="/settings"
          className="mt-2 self-start text-xs font-medium text-primary hover:underline"
        >
          Open settings
        </Link>
      </Card>
    );
  }

  const breachDays = report.days.filter((d) => !d.compliant);
  const recentBreaches = breachDays.slice(-6).reverse();
  const scoredDays = report.compliant_days + report.breach_days;
  const adherence = scoredDays > 0 ? (report.compliant_days / scoredDays) * 100 : null;

  return (
    <Card
      title="Rule compliance"
      description="Days scored against your risk rules — following them should show up in the P&L split."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Adherence"
            value={adherence != null ? `${adherence.toFixed(0)}%` : "—"}
            hint={`${report.compliant_days} of ${scoredDays} days`}
          />
          <StatCard
            label="P&L, rules followed"
            value={money.format(report.compliant_pnl)}
            accent={report.compliant_pnl >= 0 ? "pos" : "neg"}
          />
          <StatCard
            label="P&L, rules broken"
            value={money.format(report.breach_pnl)}
            accent={report.breach_pnl >= 0 ? "pos" : "neg"}
          />
          <StatCard
            label="Violations"
            value={String(report.risk_violations + report.daily_loss_breaches)}
            hint={`${report.risk_violations} over-risked · ${report.daily_loss_breaches} daily-loss`}
          />
        </div>

        {report.unknown_risk > 0 && (
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
            {report.unknown_risk} trade{report.unknown_risk === 1 ? "" : "s"} had no recorded
            initial risk and could not be scored against the per-trade risk rule.
          </p>
        )}

        {recentBreaches.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              Recent breach days
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {recentBreaches.map((d) => (
                <li
                  key={d.date}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-foreground">
                      {fmtDayShort(d.date, locale)}
                    </span>
                    {d.risk_violations > 0 && (
                      <Pill tone="neg">over-risked ×{d.risk_violations}</Pill>
                    )}
                    {d.daily_loss_breach && <Pill tone="neg">daily loss</Pill>}
                  </span>
                  <span
                    className={
                      d.net_pnl >= 0
                        ? "tabular-nums font-medium text-profit"
                        : "tabular-nums font-medium text-destructive"
                    }
                  >
                    {money.format(d.net_pnl)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
