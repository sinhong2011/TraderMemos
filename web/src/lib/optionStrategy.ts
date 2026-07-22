/** Auto-detect simple single-leg option strategy from fills + trade side. */

export type OptionRight = "call" | "put";

export interface OptionStrategyHint {
  label: string;
  bias: "bullish" | "bearish" | "neutral";
  biasLabel: string;
}

export function detectOptionStrategy(
  side: "long" | "short",
  rights: Array<OptionRight | "" | undefined>,
): OptionStrategyHint | null {
  const cleaned = rights.filter((r): r is OptionRight => r === "call" || r === "put");
  if (cleaned.length === 0) return null;
  const allCall = cleaned.every((r) => r === "call");
  const allPut = cleaned.every((r) => r === "put");
  if (!allCall && !allPut) {
    return {
      label: "Multi-leg",
      bias: "neutral",
      biasLabel: "Mixed rights — review legs",
    };
  }
  if (allCall) {
    return side === "long"
      ? { label: "Long Call", bias: "bullish", biasLabel: "Bullish auto-detected from legs" }
      : { label: "Short Call", bias: "bearish", biasLabel: "Bearish auto-detected from legs" };
  }
  return side === "long"
    ? { label: "Long Put", bias: "bearish", biasLabel: "Bearish auto-detected from legs" }
    : { label: "Short Put", bias: "bullish", biasLabel: "Bullish auto-detected from legs" };
}

export function buildExecutionDetails(row: {
  option_right?: string;
  strike?: string;
  expiry?: string;
}): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  const right = row.option_right?.trim().toLowerCase();
  if (right === "call" || right === "put") out.option_right = right;
  const strike = row.strike?.trim();
  if (strike) out.strike = strike;
  const expiry = row.expiry?.trim();
  if (expiry) out.expiry = expiry;
  return Object.keys(out).length > 0 ? out : undefined;
}
