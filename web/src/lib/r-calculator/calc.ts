/**
 * 交易 R 倍數計算 — pure functions, no framework.
 *
 * Cash positions only, no leverage. Given an entry and a stop, we size the
 * position so the loss at the stop equals the chosen % of capital (the "1R"
 * risk), then cap it so we never spend more cash than we have.
 */

export type Direction = "long" | "short";

/** Why the share count landed where it did. Rendered via i18n `limiter.*`. */
export type Limiter = "risk" | "cash" | "none";

export interface CalcInput {
  direction: Direction;
  /** Entry price (stock) or entry premium per share (options). */
  entry: number;
  /** Stop price (stock) or stop premium per share (options). */
  stop: number;
  /** Account capital (cash). */
  capital: number;
  /** Risk per trade as a percent of capital, e.g. 1 = 1%. */
  riskPct: number;
  /**
   * Contract size / share multiplier per unit. 1 for a stock share, 100 for a
   * standard option contract. Cost and risk per unit scale by this.
   */
  multiplier?: number;
}

export interface CalcResult {
  /** 1R — the per-share risk, |entry − stop|. */
  r1: number;
  /** Cash amount put at risk by the chosen risk %. */
  riskAmt: number;
  /** Shares the risk budget alone would allow. */
  sharesByRisk: number;
  /** Shares the available cash alone would allow. */
  sharesByCash: number;
  /** Final unit count (shares or contracts) — the tighter of the two limits. */
  shares: number;
  /** Position market value (stock) / premium debit paid (options). */
  posValue: number;
  /** Actual cash at risk for the final unit count. */
  realRisk: number;
  /** Worst case if it goes to zero (stock) / full premium debit (options). */
  maxLoss: number;
  /** Which constraint bound the size. */
  limiter: Limiter;
  /** The −1R price level (mirrors the stop when it is on the valid side). */
  stopPrice: number;
  /** +2R target price. */
  target2: number;
  /** +3R target price. */
  target3: number;
  /** Profit at the +2R target. */
  profit2: number;
  /** Profit at the +3R target. */
  profit3: number;
  /** Cash left after taking the position. */
  remainingCash: number;
  /**
   * True for tradeable geometry — the stop sits on the loss side of the entry.
   * When false the position is sized to zero so no confident numbers appear
   * next to the danger warning (same contract as FvgResult.valid).
   */
  valid: boolean;
}

/** Coerce a possibly-empty / NaN field to a finite number. */
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function calc(input: CalcInput): CalcResult {
  const direction = input.direction;
  const entry = finite(input.entry);
  const stop = finite(input.stop);
  const capital = finite(input.capital);
  const riskPct = finite(input.riskPct);
  const m = finite(input.multiplier ?? 1) || 1;
  const long = direction === "long";

  const r1 = Math.abs(entry - stop);
  const riskAmt = (capital * riskPct) / 100;

  // Per-unit cost and risk scale by the contract multiplier (1 = share, 100 = option).
  const costPerUnit = entry * m;
  const riskPerUnit = r1 * m;

  const valid = long ? stop < entry : stop > entry;

  const sharesByRisk = riskPerUnit > 0 ? Math.floor(riskAmt / riskPerUnit) : 0;
  const sharesByCash = costPerUnit > 0 ? Math.floor(capital / costPerUnit) : 0;
  const shares = valid ? Math.min(sharesByRisk, sharesByCash) : 0;

  const posValue = shares * costPerUnit;
  const realRisk = shares * riskPerUnit;
  const maxLoss = posValue;

  const limiter: Limiter = !valid
    ? "none"
    : shares === sharesByCash && sharesByCash < sharesByRisk
      ? "cash"
      : shares === sharesByRisk
        ? "risk"
        : "none";

  const stopPrice = long ? entry - r1 : entry + r1;
  const target2 = long ? entry + 2 * r1 : entry - 2 * r1;
  const target3 = long ? entry + 3 * r1 : entry - 3 * r1;
  const profit2 = shares * 2 * riskPerUnit;
  const profit3 = shares * 3 * riskPerUnit;
  const remainingCash = capital - posValue;

  return {
    r1,
    riskAmt,
    sharesByRisk,
    sharesByCash,
    shares,
    posValue,
    realRisk,
    maxLoss,
    limiter,
    stopPrice,
    target2,
    target3,
    profit2,
    profit3,
    remainingCash,
    valid,
  };
}

export type WarningTone = "danger" | "caution" | "ok";

/**
 * Stable i18n keys for every 防呆 notice (calc + exit). The UI maps these to
 * localized text via `t`, keeping this engine locale-agnostic.
 */
export type WarningKey =
  | "warn_stop_below_entry_long"
  | "warn_stop_above_entry_short"
  | "warn_capital_too_small_stock"
  | "warn_risk_below_setting"
  | "warn_prem_stop_vs_entry"
  | "warn_capital_too_small_option"
  | "warn_risk_budget_too_small"
  | "warn_tier_sum_over100"
  | "warn_tier_rnon_positive"
  | "warn_trailer_stop_too_high"
  | "warn_fvg_zone_invalid"
  | "warn_fvg_oner_nonpositive"
  | "warn_fvg_account_too_small";

export interface Warning {
  tone: WarningTone;
  key: WarningKey;
}

/**
 * 防呆警告 — speaks in the interface's own voice: says how to fix it, no
 * apologies, no hedging. Returns keys; the UI localizes them.
 */
export function warnings(input: CalcInput, result: CalcResult): Warning[] {
  const out: Warning[] = [];
  const entry = finite(input.entry);
  const stop = finite(input.stop);
  const capital = finite(input.capital);

  if (input.direction === "long" && stop >= entry) {
    out.push({ tone: "danger", key: "warn_stop_below_entry_long" });
  }
  if (input.direction === "short" && stop <= entry) {
    out.push({ tone: "danger", key: "warn_stop_above_entry_short" });
  }
  // Only explain a zero size when the geometry is tradeable — with the stop
  // on the wrong side, the danger notice above is the whole story.
  if (result.valid && result.shares === 0 && entry > capital) {
    out.push({ tone: "caution", key: "warn_capital_too_small_stock" });
  }
  if (result.limiter === "cash") {
    out.push({ tone: "ok", key: "warn_risk_below_setting" });
  }
  return out;
}

/**
 * 防呆警告 for buying options (long premium). The buyer profits when the premium
 * rises, so the stop premium should sit below the entry premium.
 */
export function optionWarnings(input: CalcInput, result: CalcResult): Warning[] {
  const out: Warning[] = [];
  const entry = finite(input.entry);
  const stop = finite(input.stop);
  const capital = finite(input.capital);
  const m = finite(input.multiplier ?? 1) || 1;
  const costPerContract = entry * m;

  if (stop >= entry) {
    out.push({ tone: "danger", key: "warn_prem_stop_vs_entry" });
  }
  if (result.valid && result.shares === 0 && costPerContract > capital) {
    out.push({ tone: "caution", key: "warn_capital_too_small_option" });
  }
  // Can afford a contract, but the risk budget is smaller than one contract's
  // risk (premium × multiplier) — explain the zero instead of leaving it silent.
  if (result.valid && result.shares === 0 && result.sharesByCash > 0 && result.sharesByRisk === 0) {
    out.push({ tone: "caution", key: "warn_risk_budget_too_small" });
  }
  if (result.limiter === "cash") {
    out.push({ tone: "ok", key: "warn_risk_below_setting" });
  }
  return out;
}
