import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExecScorePoint, ExecScoreReport } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useDisplayTimePrefs } from "@/lib/displayPrefs";
import { fmtDayShort } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { Card } from "./Card";
import { ChartFrame, chartTheme, chartTooltipStyle } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";

export type ExecScoreBucket = "week" | "month";

type AxisKey = "composite" | "entry" | "exit" | "risk" | "stability" | "tempo";

const AXES: { key: AxisKey; label: string; hint: string }[] = [
  { key: "composite", label: "Composite", hint: "Weighted blend of the five axes below." },
  {
    key: "entry",
    label: "Entry",
    hint: "How little heat entries take relative to the move they find (MAE vs MFE).",
  },
  { key: "exit", label: "Exit", hint: "Share of each trade's peak open profit kept at the close." },
  {
    key: "risk",
    label: "Risk",
    hint: "Risk journaled before the trade, blended with rule compliance when rules are set.",
  },
  {
    key: "stability",
    label: "Stability",
    hint: "Consistency of results — average R per unit of variance.",
  },
  {
    key: "tempo",
    label: "Tempo",
    hint: "Trades free of quick same-symbol re-entries and overtraded days.",
  },
];

const BUCKETS: { value: ExecScoreBucket; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

/** Quality band for a 0–100 score; drives the composite's caption. */
export function execScoreBand(score: number): string {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 55) return "solid";
  if (score >= 40) return "uneven";
  return "weak";
}

function scoreTone(score: number): string {
  if (score >= 70) return "text-profit";
  if (score < 40) return "text-destructive";
  return "text-foreground";
}

function axisScore(report: ExecScoreReport, key: AxisKey): number | null {
  return key === "composite" ? report.composite : report[key].score;
}

export interface ReportsExecutionScoreProps {
  report: ExecScoreReport | undefined;
  loading: boolean;
  error: boolean;
  bucket: ExecScoreBucket;
  onBucketChange: (b: ExecScoreBucket) => void;
}

/**
 * Execution-quality composite: a 0–100 blend of Entry / Exit / Risk /
 * Stability / Tempo, each normalized on the trader's own data. Selecting an
 * axis drills into that sub-score as a time series, so decay in a single
 * dimension is visible instead of averaged away.
 */
export function ReportsExecutionScore({
  report,
  loading,
  error,
  bucket,
  onBucketChange,
}: ReportsExecutionScoreProps) {
  useDisplayTimePrefs();
  const locale = intlLocale();
  const [axis, setAxis] = useState<AxisKey>("composite");

  const action = (
    <SegmentedControl
      ariaLabel="Score series granularity"
      value={bucket}
      onChange={(v) => onBucketChange(v as ExecScoreBucket)}
      options={BUCKETS}
    />
  );

  const selected = AXES.find((a) => a.key === axis) ?? AXES[0];

  const renderBody = () => {
    if (loading) return <Skeleton height="280px" />;
    if (error) return <p className="text-xs text-destructive">Failed to load execution score.</p>;
    if (!report || report.trades === 0) {
      return (
        <EmptyState title="No trades" hint="Add trades or adjust filters to see your score." />
      );
    }
    if (report.composite == null) {
      return (
        <EmptyState
          title="Not enough data to score"
          hint="Scores unlock at 5 closed trades — journaled risk and auto MAE/MFE sharpen every axis."
        />
      );
    }

    const radarData = AXES.filter((a) => a.key !== "composite")
      .map((a) => ({ label: a.label, score: axisScore(report, a.key) }))
      .filter((d): d is { label: string; score: number } => d.score != null);

    return (
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center gap-1">
          <p
            className={cn(
              "text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums",
              scoreTone(report.composite),
            )}
            data-testid="exec-score-composite"
          >
            {Math.round(report.composite)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {execScoreBand(report.composite)} · {report.trades} trades
          </p>
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="78%">
                <PolarGrid stroke={chartTheme.gridColor} />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke={chartTheme.accentStroke}
                  fill={chartTheme.accentStroke}
                  fillOpacity={0.18}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-6 px-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              The radar needs at least three scored axes — journal initial risk and run auto MAE/MFE
              to light up the rest.
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {AXES.map((a) => {
              const score = axisScore(report, a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  disabled={score == null}
                  onClick={() => setAxis(a.key)}
                  aria-pressed={axis === a.key}
                  className={cn(
                    "flex items-baseline gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    axis === a.key
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                    score == null && "cursor-default opacity-50 hover:bg-transparent",
                  )}
                >
                  {a.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      score == null ? "text-muted-foreground" : scoreTone(score),
                    )}
                  >
                    {score == null ? "no data" : Math.round(score)}
                  </span>
                </button>
              );
            })}
          </div>

          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={report.series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => fmtDayShort(v, locale)}
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={(v) => fmtDayShort(String(v), locale)}
                  formatter={(value, _name, item) => {
                    const point = item?.payload as ExecScorePoint | undefined;
                    const trades = point ? ` · ${point.trades} trades` : "";
                    return [`${Math.round(Number(value ?? 0))}${trades}`, selected.label];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={axis}
                  name={axis}
                  stroke={chartTheme.accentStroke}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{selected.hint}</p>
        </div>
      </div>
    );
  };

  return (
    <Card title="Execution Score" action={action}>
      {renderBody()}
    </Card>
  );
}
