import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { useReportsMoney } from "./ReportsDisplayContext";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { TRADE_GRADES, gradeFromInt } from "../lib/tradeGrades";

export interface ReportsExecutionGradeProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
}

// A+ (best) → C (worst); Unrated always last.
const GRADE_RANK: Record<string, number> = Object.fromEntries(TRADE_GRADES.map((g, i) => [g, i]));

function labelFor(key: string): { label: string; rank: number } {
  if (key === "unrated") return { label: "Unrated", rank: 999 };
  const grade = gradeFromInt(Number(key));
  if (!grade) return { label: key, rank: 998 };
  return { label: grade, rank: GRADE_RANK[grade] };
}

function pfText(pf: number): string {
  return Number.isFinite(pf) && pf > 0 ? pf.toFixed(2) : "—";
}

export function ReportsExecutionGrade({ breakdown, loading, error }: ReportsExecutionGradeProps) {
  usePrivacyMode();
  const money = useReportsMoney();

  const rows = breakdown.map((g) => ({ g, ...labelFor(g.key) })).sort((a, b) => a.rank - b.rank);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(money.pnl(r.g.summary))));

  return (
    <Card title="Execution Grade">
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load execution grade.</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No rated trades" hint="Rate your execution on trades to see this." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ g, label }) => {
            const pnl = money.pnl(g.summary);
            const pct = (Math.abs(pnl) / maxAbs) * 100;
            const barColor = pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";
            return (
              <li key={g.key} data-testid="exec-grade-row" className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span data-testid="exec-grade-label" className="text-sm font-semibold text-fg">
                    {label}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-[10px] tracking-wide text-flat">
                      PF {pfText(g.summary.profit_factor)}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${pnlColor(pnl)}`}>
                      {money.format(pnl)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-inset">
                  <div
                    data-testid="exec-grade-bar"
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <span className="text-[10px] text-flat">
                  {g.summary.wins}W · {g.summary.losses}L
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
