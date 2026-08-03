/**
 * Full-Kelly fraction of capital: W - (1-W)/R for win rate W (0..1) and
 * payoff ratio R (avg win ÷ avg loss). Negative means no positive edge.
 * Returns null when inputs are out of range (payoff must be > 0).
 * Ported verbatim from web/src/lib/kelly.ts.
 */
export function kellyFraction(winRate: number, payoff: number): number | null {
  if (!Number.isFinite(winRate) || !Number.isFinite(payoff)) return null;
  if (winRate < 0 || winRate > 1 || payoff <= 0) return null;
  return winRate - (1 - winRate) / payoff;
}
