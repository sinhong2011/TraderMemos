/** Common futures point-value presets for log-trade multiplier. */
export interface FuturesPreset {
  id: string;
  symbol: string;
  label: string;
  multiplier: number;
}

export const FUTURES_PRESETS: readonly FuturesPreset[] = [
  { id: "nq", symbol: "NQ", label: "NQ ($20/pt)", multiplier: 20 },
  { id: "es", symbol: "ES", label: "ES ($50/pt)", multiplier: 50 },
  { id: "ym", symbol: "YM", label: "YM ($5/pt)", multiplier: 5 },
  { id: "rty", symbol: "RTY", label: "RTY ($5/pt)", multiplier: 5 },
  { id: "gc", symbol: "GC", label: "GC ($100/pt)", multiplier: 100 },
  { id: "cl", symbol: "CL", label: "CL ($1000/pt)", multiplier: 1000 },
] as const;

export const CUSTOM_PRESET_ID = "custom";

/** Resolve multiplier from a selected preset id, or 1 for custom/unknown. */
export function multiplierForPreset(presetId: string): number {
  const p = FUTURES_PRESETS.find((x) => x.id === presetId);
  return p?.multiplier ?? 1;
}

/** Match a symbol root to a known futures preset (case-insensitive). */
export function presetIdForSymbol(symbol: string): string {
  const root = symbol.trim().toUpperCase();
  const p = FUTURES_PRESETS.find((x) => x.symbol === root);
  return p?.id ?? CUSTOM_PRESET_ID;
}
