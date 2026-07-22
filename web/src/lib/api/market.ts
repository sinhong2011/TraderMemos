import { apiFetch, qs } from "./client";

export type BarInterval = "1" | "5" | "15" | "60" | "240" | "D";

export interface MarketBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketBarsResponse {
  symbol: string;
  interval: BarInterval;
  from: string;
  to: string;
  provider: string;
  cached: boolean;
  bars: MarketBar[];
}

export const marketApi = {
  bars: (params: {
    symbol: string;
    instrument_type: string;
    from: string;
    to: string;
    interval?: BarInterval;
  }) =>
    apiFetch<MarketBarsResponse>(`/market/bars${qs(params as Record<string, string | undefined>)}`),

  fx: (params: { from: string; to: string }) => apiFetch<FxRateResponse>(`/market/fx${qs(params)}`),
};

export interface FxRateResponse {
  from: string;
  to: string;
  rate: number;
  as_of: string;
  provider: string;
  cached: boolean;
}
