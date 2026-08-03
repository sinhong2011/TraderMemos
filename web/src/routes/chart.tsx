import { createFileRoute } from "@tanstack/react-router";
import { AdvancedChartView } from "@/app/screens/AdvancedChartView";
import type { BarInterval } from "@/lib/api/market";

const INTERVALS: readonly BarInterval[] = ["1", "5", "15", "60", "240", "D"];

export function validateChartSearch(search: Record<string, unknown>): {
  symbol?: string;
  iv: BarInterval;
} {
  const raw = typeof search.symbol === "string" ? search.symbol.trim().toUpperCase() : "";
  const symbol = /^[A-Z0-9./-]{1,15}$/.test(raw) ? raw : undefined;
  const iv = INTERVALS.includes(search.iv as BarInterval) ? (search.iv as BarInterval) : "D";
  return symbol ? { symbol, iv } : { iv };
}

export const Route = createFileRoute("/chart")({
  validateSearch: validateChartSearch,
  component: ChartPage,
});

function ChartPage() {
  const { symbol, iv } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdvancedChartView
      symbol={symbol ?? ""}
      interval={iv}
      onSymbolChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, symbol: next || undefined }) })
      }
      onIntervalChange={(next) => void navigate({ search: (prev) => ({ ...prev, iv: next }) })}
    />
  );
}
