import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";
import type { RSummary } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";

export interface ReportsRMultiplePerformanceProps {
  rSummary?: RSummary;
  loading: boolean;
  error: boolean;
}

function formatR(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function ReportsRMultiplePerformance({
  rSummary,
  loading,
  error,
}: ReportsRMultiplePerformanceProps) {
  usePrivacyMode();
  // `total_trades` here is already the R-eligible (included) count — `excluded`
  // is a disjoint count of trades skipped for missing risk, not a subset of it.
  const included = rSummary?.total_trades ?? 0;

  return (
    <Card title="R-Multiple Performance">
      {loading ? (
        <Skeleton height="100px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load R-multiple performance.</p>
      ) : !rSummary || included <= 0 ? (
        <EmptyState title="No R data" hint="Set stops on your trades to see R-multiples." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Avg R/Trade"
            value={formatR(rSummary.avg_r)}
            accent={rSummary.avg_r >= 0 ? "pos" : "neg"}
            hint={`${included} of ${included + rSummary.excluded} trades`}
          />
          <StatCard label="Avg Winning R" value={formatR(rSummary.avg_win_r)} accent="pos" />
          <StatCard label="Avg Losing R" value={formatR(rSummary.avg_loss_r)} accent="neg" />
          <StatCard
            label="Best / Worst R"
            value={`${formatR(rSummary.best_r)} / ${formatR(rSummary.worst_r)}`}
          />
        </div>
      )}
    </Card>
  );
}
