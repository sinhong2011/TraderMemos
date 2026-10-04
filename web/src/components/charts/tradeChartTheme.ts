export interface TradeChartTheme {
  background: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  buyMarker: string;
  sellMarker: string;
  targetLine: string;
  stopLine: string;
  entryLine: string;
}

// Lightweight Charts paints to a canvas and parses colors itself, so it can't
// take `var(--…)` or oklch — each token is resolved to rgba here instead.
const TOKENS: Record<Exclude<keyof TradeChartTheme, "background">, string> = {
  text: "--muted-foreground",
  grid: "--border",
  border: "--border",
  up: "--profit",
  down: "--loss",
  buyMarker: "--info",
  sellMarker: "--muted-foreground",
  targetLine: "--profit",
  stopLine: "--loss",
  entryLine: "--info",
};

/** Last-resort palette (dark) for environments that can't compute styles. */
const FALLBACK: Omit<TradeChartTheme, "background"> = {
  text: "rgba(180,180,191,1)",
  grid: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  up: "rgba(82,202,150,1)",
  down: "rgba(235,75,104,1)",
  buyMarker: "rgba(79,165,255,1)",
  sellMarker: "rgba(138,146,166,1)",
  targetLine: "rgba(82,202,150,1)",
  stopLine: "rgba(235,75,104,1)",
  entryLine: "rgba(79,165,255,1)",
};

let pixel: CanvasRenderingContext2D | null | undefined;

/** Resolves a CSS color (any syntax the browser knows) to `rgba(r,g,b,a)`. */
function toRgba(color: string): string | null {
  if (pixel === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    try {
      pixel = canvas.getContext("2d", { willReadFrequently: true });
    } catch {
      pixel = null;
    }
  }
  if (!pixel) return null;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = "#000";
  pixel.fillStyle = color;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${Math.round((a / 255) * 1000) / 1000})`;
}

/**
 * The trade chart palette for the theme currently applied to `<html>`. Call it
 * again after the theme class changes — the values are snapshots.
 */
export function readTradeChartTheme(): TradeChartTheme {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.append(probe);
  const theme = { background: "transparent" } as TradeChartTheme;
  for (const [key, token] of Object.entries(TOKENS) as [keyof typeof TOKENS, string][]) {
    probe.style.color = `var(${token})`;
    const computed = getComputedStyle(probe).color;
    theme[key] = (computed && toRgba(computed)) || FALLBACK[key];
  }
  probe.remove();
  return theme;
}

export const BAR_INTERVALS = [
  { value: "1" as const, label: "1m" },
  { value: "5" as const, label: "5m" },
  { value: "15" as const, label: "15m" },
  { value: "60" as const, label: "1H" },
  { value: "240" as const, label: "4H" },
  { value: "D" as const, label: "1D" },
];
