import type { EdgeComponents, EdgeInputs, EdgeScore } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { fmtPct } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { execScoreBand } from "./ReportsExecutionScore";
import { Skeleton } from "./Skeleton";

type ComponentKey = keyof EdgeComponents;

interface ComponentDef {
  key: ComponentKey;
  label: string;
  /** What full marks takes, from api/internal/analytics/edge.go. */
  target: string;
  value: (inputs: EdgeInputs, locale: string) => string;
}

const ratio = (v: number) => v.toFixed(2);

const COMPONENTS: ComponentDef[] = [
  {
    key: "profit_factor",
    label: "Profit factor",
    target: "3.0",
    value: (i) => (i.profit_factor == null ? "No losses" : ratio(i.profit_factor)),
  },
  {
    key: "payoff",
    label: "Avg win / loss",
    target: "2.5 : 1",
    value: (i) => (i.payoff == null ? "No losses" : `${ratio(i.payoff)} : 1`),
  },
  {
    key: "win_rate",
    label: "Win rate",
    target: "60%",
    value: (i, locale) => fmtPct(i.win_rate, locale),
  },
  {
    key: "drawdown",
    label: "Max drawdown",
    target: "0% of capital (25% scores 0)",
    value: (i, locale) =>
      i.max_drawdown_pct == null
        ? "No deposits"
        : `${fmtPct(i.max_drawdown_pct, locale)} of capital`,
  },
  {
    key: "consistency",
    label: "Consistency",
    target: "best day ≤ 15% of winning days",
    value: (i, locale) =>
      i.best_day_share == null ? "No winning days" : `Best day ${fmtPct(i.best_day_share, locale)}`,
  },
  {
    key: "recovery",
    label: "Recovery",
    target: "net P&L 3× max drawdown",
    value: (i) => (i.recovery_factor == null ? "No drawdown" : `${ratio(i.recovery_factor)}×`),
  },
];

function scoreTone(score: number): string {
  if (score >= 70) return "text-profit";
  if (score < 40) return "text-destructive";
  return "text-foreground";
}

function barTone(score: number): string {
  if (score >= 70) return "bg-profit";
  if (score < 40) return "bg-destructive";
  return "bg-primary";
}

export interface ReportsEdgeScoreProps {
  edge: EdgeScore | undefined;
  loading: boolean;
  error: boolean;
}

/**
 * Edge Score: an open, versioned 0–100 composite of six outcome metrics, each
 * scaled to a fixed full-marks threshold. Unlike the Execution Score it needs
 * no journaled risk or MAE/MFE — only closed trades and the cash ledger.
 */
export function ReportsEdgeScore({ edge, loading, error }: ReportsEdgeScoreProps) {
  const locale = intlLocale();

  const renderBody = () => {
    if (loading) return <Skeleton height="240px" />;
    if (error) return <p className="text-xs text-destructive">Failed to load Edge Score.</p>;
    if (!edge || edge.closed_trades === 0) {
      return (
        <EmptyState title="No trades" hint="Add trades or adjust filters to see your score." />
      );
    }
    if (edge.score == null) {
      return (
        <EmptyState
          title="Not enough trades to score"
          hint={`The Edge Score needs ${edge.min_trades} closed trades — ${edge.closed_trades} in range.`}
        />
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center justify-center gap-1">
          <p
            className={cn(
              "text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums",
              scoreTone(edge.score),
            )}
            data-testid="edge-score-value"
          >
            {Math.round(edge.score)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {execScoreBand(edge.score)} · {edge.closed_trades} trades
          </p>
          <p className="text-[11px] text-muted-foreground">Formula v{edge.version}</p>
        </div>

        <ul className="flex min-w-0 flex-col gap-3">
          {COMPONENTS.map((c) => {
            const score = edge.components[c.key];
            return (
              <li key={c.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground">
                    {c.label}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {edge.weights[c.key]}%
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">
                      {c.value(edge.inputs, locale)}
                    </span>
                    <span className={cn("w-7 text-right font-medium", scoreTone(score))}>
                      {Math.round(score)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", barTone(score))}
                    style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Full marks: {c.target}</p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Card
      title="Edge Score"
      description="Each metric scores 0–100 against a fixed target and is weighted as shown."
    >
      {renderBody()}
    </Card>
  );
}
