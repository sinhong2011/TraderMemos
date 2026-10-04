import type { SetupScore, SetupVerdict } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Pill, type PillTone } from "./Pill";

/** Label, tone and the one-line advice for each scorecard verdict. */
export const VERDICT_META: Record<
  SetupVerdict,
  { label: string; tone: PillTone; advice: string; ink: string }
> = {
  edge: {
    label: "Edge",
    tone: "pos",
    advice: "Proven edge — size up within your risk rules.",
    ink: "bg-profit",
  },
  execution: {
    label: "Execution leak",
    tone: "amber",
    advice: "The setup pays when you follow it — the losses come from the mistake-tagged trades.",
    ink: "bg-warning",
  },
  promising: {
    label: "Promising",
    tone: "accent",
    advice: "Positive so far, not proven yet — keep taking it at normal size.",
    ink: "bg-primary",
  },
  watch: {
    label: "Watch",
    tone: "muted",
    advice: "Negative so far, but not enough trades to call it.",
    ink: "bg-muted-foreground",
  },
  unproven: {
    label: "Too early",
    tone: "muted",
    advice: "Needs at least 10 trades before it can be judged.",
    ink: "bg-muted-foreground",
  },
  bleeding: {
    label: "Bleeding",
    tone: "neg",
    advice: "Losing over enough trades to trust it — stop or rework the setup.",
    ink: "bg-loss",
  },
};

export function VerdictPill({ score }: { score: SetupScore }) {
  const meta = VERDICT_META[score.verdict];
  const label =
    score.verdict === "unproven"
      ? `${meta.label} · ${score.basis === "r" ? score.r_trades : score.trades}/10`
      : meta.label;
  return (
    <Pill tone={meta.tone} title={meta.advice} className="px-1.5 py-0 text-2xs">
      {label}
    </Pill>
  );
}

/**
 * Expectancy with its 95% interval on a shared axis centred on zero: the dot is
 * the mean, the whisker the interval. A setup with an edge sits clear of the
 * zero line; an unproven one straddles it.
 */
export function ExpectancyInterval({
  score,
  maxAbs,
  className,
}: {
  score: SetupScore;
  /** Largest |value| among rows sharing this basis — keeps rows comparable. */
  maxAbs: number;
  className?: string;
}) {
  const scale = maxAbs > 0 ? maxAbs : 1;
  const pos = (v: number) => `${50 + (Math.max(-scale, Math.min(scale, v)) / scale) * 46}%`;
  const ink = VERDICT_META[score.verdict].ink;
  const hasCI = score.ci_low != null && score.ci_high != null;

  return (
    <div
      aria-hidden
      className={cn("relative h-4 w-full", className)}
      title={VERDICT_META[score.verdict].advice}
    >
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      {hasCI ? (
        <span
          className={cn("absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full opacity-45", ink)}
          style={{ left: pos(score.ci_low!), right: `calc(100% - ${pos(score.ci_high!)})` }}
        />
      ) : null}
      <span
        className={cn(
          "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          ink,
        )}
        style={{ left: pos(score.mean) }}
      />
    </div>
  );
}

/** Largest |mean| or interval end among rows in each basis. */
export function intervalScales(scores: SetupScore[]): Record<SetupScore["basis"], number> {
  const out = { r: 0, currency: 0 };
  for (const s of scores) {
    for (const v of [s.mean, s.ci_low, s.ci_high]) {
      if (v != null) out[s.basis] = Math.max(out[s.basis], Math.abs(v));
    }
  }
  return out;
}
