/**
 * 出場階梯 — scale-out / trailing-runner math, pure and framework-free.
 *
 * A position of N units is partly sold at one or more R-multiple targets
 * (tiers); the remainder ("trailer") runs with a configurable stop. All math
 * mirrors calc.ts: direction-aware prices and finite-guarded inputs.
 */
import type { Direction, Warning } from "./calc";

export interface ExitTier {
  /** R-multiple of the scale-out level, > 0 (e.g. 2 = +2R). */
  r: number;
  /** Percent of the total position sold at this tier, 0–100. */
  pct: number;
}

export type TrailerStop =
  | { kind: "breakeven" } // stop at entry (R = 0) — risk-free runner
  | { kind: "original" } // stop stays at −1R
  | { kind: "custom"; r: number }; // stop at a chosen R level

export interface ExitPlan {
  tiers: ExitTier[];
  trailerStop: TrailerStop;
}

/** A named starting template for the exit ladder. Label/sub are i18n keys. */
export interface ExitPreset {
  id: "aggressive" | "conservative";
  plan: ExitPlan;
}

/**
 * Two opinionated ladders. **Aggressive** banks the bulk at a 2:1 reward and
 * lets a lean runner ride risk-free — the default. **Conservative** de-risks
 * early: sell half at +1R, another quarter at +2R, trail the rest from
 * breakeven — lower expectancy, faster to a risk-free position. The chip
 * label/sub are localized in the UI via `preset.<id>` keys.
 */
export const EXIT_PRESETS: readonly ExitPreset[] = [
  {
    id: "aggressive",
    plan: { tiers: [{ r: 2, pct: 75 }], trailerStop: { kind: "breakeven" } },
  },
  {
    id: "conservative",
    plan: {
      tiers: [
        { r: 1, pct: 50 },
        { r: 2, pct: 25 },
      ],
      trailerStop: { kind: "breakeven" },
    },
  },
];

/** Canonical string for a plan, order-independent in tiers — for preset match. */
function planKey(plan: ExitPlan): string {
  const tiers = [...plan.tiers]
    .map((t) => ({ r: finite(t.r), pct: finite(t.pct) }))
    .sort((a, b) => a.r - b.r || a.pct - b.pct);
  return JSON.stringify({ tiers, trailerStop: plan.trailerStop });
}

/** Id of the preset structurally equal to `plan`, or null if it's been edited. */
export function matchPreset(plan: ExitPlan): string | null {
  const key = planKey(plan);
  return EXIT_PRESETS.find((p) => planKey(p.plan) === key)?.id ?? null;
}

export interface ExitContext {
  /** Final unit count from calc(). */
  shares: number;
  /** Per-unit risk = r1 × multiplier. */
  riskPerUnit: number;
  entry: number;
  /** |entry − stop|. */
  r1: number;
  direction: Direction;
  /** realRisk = shares × riskPerUnit. */
  initialRisk: number;
}

export interface ExitTierResult {
  r: number;
  pct: number;
  shares: number;
  price: number;
  profit: number;
}

export interface ExitPlanResult {
  tiers: ExitTierResult[];
  trailerShares: number;
  trailerStopR: number;
  trailerStopPrice: number;
  /** Σ tier profit — banked when all tiers hit. */
  locked: number;
  /** locked + trailer-at-stop — the guaranteed minimum. */
  floor: number;
  /** floor ÷ initialRisk. */
  floorR: number;
  /** Value of each additional +1R on the trailer. */
  perR: number;
  /** Reference exit for the runner. */
  trailerTargetR: number;
  totalAtTarget: number;
  blendedRAtTarget: number;
  /** Drives the R-axis range. */
  maxAxisR: number;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function priceAt(r: number, ctx: ExitContext): number {
  const entry = finite(ctx.entry);
  const r1 = finite(ctx.r1);
  return ctx.direction === "long" ? entry + r * r1 : entry - r * r1;
}

function resolveStopR(stop: TrailerStop): number {
  switch (stop.kind) {
    case "breakeven":
      return 0;
    case "original":
      return -1;
    case "custom":
      return finite(stop.r);
  }
}

export function computeExitPlan(plan: ExitPlan, ctx: ExitContext): ExitPlanResult {
  const N = Math.max(0, Math.floor(finite(ctx.shares)));
  const riskPerUnit = finite(ctx.riskPerUnit);
  const initialRisk = finite(ctx.initialRisk);

  const sorted = [...plan.tiers].sort((a, b) => finite(a.r) - finite(b.r));

  let remaining = N;
  const tiers: ExitTierResult[] = sorted.map((t) => {
    const r = finite(t.r);
    const pct = finite(t.pct);
    const sh = Math.min(remaining, Math.max(0, Math.floor((N * pct) / 100)));
    remaining -= sh;
    return { r, pct, shares: sh, price: priceAt(r, ctx), profit: sh * r * riskPerUnit };
  });

  const trailerShares = remaining;
  const trailerStopR = resolveStopR(plan.trailerStop);
  const trailerStopPrice = priceAt(trailerStopR, ctx);

  const locked = tiers.reduce((s, t) => s + t.profit, 0);
  const floor = locked + trailerShares * trailerStopR * riskPerUnit;
  const floorR = initialRisk > 0 ? floor / initialRisk : 0;
  const perR = trailerShares * riskPerUnit;

  const topTierR = sorted.length ? finite(sorted[sorted.length - 1].r) : 0;
  const trailerTargetR = Math.max(topTierR + 1, 3);
  const totalAtTarget = locked + trailerShares * trailerTargetR * riskPerUnit;
  const blendedRAtTarget = initialRisk > 0 ? totalAtTarget / initialRisk : 0;
  const maxAxisR = Math.max(topTierR, trailerTargetR, 3);

  return {
    tiers,
    trailerShares,
    trailerStopR,
    trailerStopPrice,
    locked,
    floor,
    floorR,
    perR,
    trailerTargetR,
    totalAtTarget,
    blendedRAtTarget,
    maxAxisR,
  };
}

/** 防呆警告 for the exit ladder — same voice/shape as calc.ts warnings. */
export function exitWarnings(plan: ExitPlan): Warning[] {
  const out: Warning[] = [];

  const sumPct = plan.tiers.reduce((s, t) => s + finite(t.pct), 0);
  if (sumPct > 100) {
    out.push({ tone: "danger", key: "warn_tier_sum_over100" });
  }
  if (plan.tiers.some((t) => finite(t.r) <= 0)) {
    out.push({ tone: "danger", key: "warn_tier_rnon_positive" });
  }
  if (plan.trailerStop.kind === "custom" && plan.tiers.length > 0) {
    const minTierR = Math.min(...plan.tiers.map((t) => finite(t.r)));
    if (finite(plan.trailerStop.r) >= minTierR) {
      out.push({ tone: "caution", key: "warn_trailer_stop_too_high" });
    }
  }
  return out;
}
