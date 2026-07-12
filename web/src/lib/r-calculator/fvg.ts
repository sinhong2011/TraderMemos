/**
 * FVG (Fair-Value-Gap) sizing — pure functions, no framework.
 *
 * Given a gap's upper/lower edges, a chosen entry within the gap, and a stop
 * just outside it, size the position by risk so the loss at the stop equals the
 * chosen % of the account (1R), then report the R-multiple target and P/L.
 */
import type { Direction, Warning } from "./calc";

export type EntryAt = "top" | "mid" | "bottom" | "manual";

export interface FvgInput {
  direction: Direction;
  /** Upper edge of the gap. */
  zoneTop: number;
  /** Lower edge of the gap. */
  zoneBottom: number;
  /** Which gap level (or manual) the entry sits at. */
  entryAt: EntryAt;
  /** Entry price when `entryAt === "manual"`. */
  entryPrice: number;
  /** Extra price padding placed beyond the gap edge for the stop. */
  stopBuffer: number;
  /** Account capital (cash). */
  account: number;
  /** Risk per trade as a percent of the account, e.g. 1 = 1%. */
  riskPct: number;
  /** Target as a multiple of 1R, e.g. 2 = 2R. */
  rMultiple: number;
}

export interface FvgResult {
  entryPrice: number;
  stopPrice: number;
  /** Per-share risk, |entry − stop|, sign-corrected per direction. */
  oneR: number;
  targetPrice: number;
  /** Cash put at risk by the chosen risk %. */
  riskDollar: number;
  /** Share count the risk budget allows (floored). */
  shares: number;
  positionValue: number;
  profitAtTarget: number;
  lossAtStop: number;
  /** Realised reward:risk for the computed target. */
  realRR: number;
  /** True for tradeable geometry (oneR > 0); shares may still be 0 if the risk budget is below 1R. */
  valid: boolean;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** Resolve the entry price from the chosen gap level. */
function entryFor(input: FvgInput, top: number, bottom: number): number {
  switch (input.entryAt) {
    case "top":
      return top;
    case "bottom":
      return bottom;
    case "mid":
      return (top + bottom) / 2;
    case "manual":
      return finite(input.entryPrice);
    default:
      return top;
  }
}

export function computeFvg(input: FvgInput): FvgResult {
  const top = finite(input.zoneTop);
  const bottom = finite(input.zoneBottom);
  const buffer = finite(input.stopBuffer);
  const account = finite(input.account);
  const riskPct = finite(input.riskPct);
  const rMultiple = finite(input.rMultiple);
  const long = input.direction === "long";

  const entryPrice = entryFor(input, top, bottom);
  const stopPrice = long ? bottom - buffer : top + buffer;
  const oneR = long ? entryPrice - stopPrice : stopPrice - entryPrice;
  const targetPrice = long ? entryPrice + rMultiple * oneR : entryPrice - rMultiple * oneR;

  const riskDollar = (account * riskPct) / 100;
  const valid = oneR > 0;
  const shares = valid ? Math.floor(riskDollar / oneR) : 0;

  const positionValue = shares * entryPrice;
  const lossAtStop = shares * oneR;
  const profitAtTarget = shares * Math.abs(targetPrice - entryPrice);
  const realRR = oneR > 0 ? Math.abs(targetPrice - entryPrice) / oneR : 0;

  return {
    entryPrice,
    stopPrice,
    oneR,
    targetPrice,
    riskDollar,
    shares,
    positionValue,
    profitAtTarget,
    lossAtStop,
    realRR,
    valid,
  };
}

/**
 * 防呆警告 for FVG sizing — speaks in the interface's own voice, returns stable
 * i18n keys the UI localizes.
 */
export function fvgWarnings(input: FvgInput, result: FvgResult): Warning[] {
  const out: Warning[] = [];
  const top = finite(input.zoneTop);
  const bottom = finite(input.zoneBottom);

  if (top <= bottom) {
    out.push({ tone: "danger", key: "warn_fvg_zone_invalid" });
  }
  if (result.oneR <= 0) {
    out.push({ tone: "danger", key: "warn_fvg_oner_nonpositive" });
  } else if (result.shares === 0) {
    out.push({ tone: "caution", key: "warn_fvg_account_too_small" });
  }
  return out;
}
