export const tradeChartTheme = {
  background: "transparent",
  text: "#b4b4bf",
  grid: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.08)",
  up: "#52ca96",
  down: "#eb4b68",
  buyMarker: "#4fa5ff",
  sellMarker: "#8a92a6",
  targetLine: "#52ca96",
  stopLine: "#eb4b68",
  entryLine: "#4fa5ff",
} as const;

export const BAR_INTERVALS = [
  { value: "1" as const, label: "1m" },
  { value: "5" as const, label: "5m" },
  { value: "15" as const, label: "15m" },
  { value: "60" as const, label: "1H" },
  { value: "240" as const, label: "4H" },
  { value: "D" as const, label: "1D" },
];
