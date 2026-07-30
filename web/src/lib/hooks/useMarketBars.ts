import { useQuery } from "@tanstack/react-query";
import { type BarInterval, marketApi } from "@/lib/api/market";

/** E2E fixtures and invalid tickers should not hit market data APIs. */
export function isChartableSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s || s.startsWith("E2E")) return false;
  return /[A-Z]/.test(s);
}

/** Round to minute boundary for stable react-query keys and server cache. */
export function snapChartTime(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export function useMarketBars(params: {
  symbol: string;
  instrument_type: string;
  from: string | null | undefined;
  to: string | null | undefined;
  interval?: BarInterval;
  enabled?: boolean;
}) {
  const chartable = isChartableSymbol(params.symbol);
  const enabled =
    chartable && (params.enabled ?? true) && Boolean(params.symbol && params.from && params.to);

  return useQuery({
    queryKey: [
      "market-bars",
      params.symbol,
      params.instrument_type,
      params.from,
      params.to,
      params.interval,
    ],
    queryFn: () =>
      marketApi.bars({
        symbol: params.symbol,
        instrument_type: params.instrument_type,
        from: params.from!,
        to: params.to!,
        interval: params.interval,
      }),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function defaultBarInterval(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): BarInterval {
  if (!fromIso || !toIso) return "5";
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const ms = Math.max(to - from, 60_000);
  if (ms <= 2 * 3_600_000) return "1";
  if (ms <= 8 * 3_600_000) return "5";
  if (ms <= 3 * 86_400_000) return "15";
  if (ms <= 14 * 86_400_000) return "60";
  return "D";
}

export function chartWindowFromTrade(
  openedAt: string,
  closedAt: string | null,
): {
  from: string;
  to: string;
} {
  const opened = new Date(openedAt);
  const closed = closedAt ? new Date(closedAt) : new Date();
  return {
    from: snapChartTime(opened.toISOString()),
    to: snapChartTime(closed.toISOString()),
  };
}
