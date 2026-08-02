import { apiFetch, qs } from "./client";

export type EconomicImpact = "high" | "medium" | "low" | "holiday";

export interface EconomicEvent {
  id: number;
  provider: string;
  title: string;
  country: string;
  impact: EconomicImpact;
  /** RFC3339 UTC */
  time: string;
  forecast: string;
  previous: string;
  actual: string;
}

export const economicEventsApi = {
  list: (params: { from: string; to: string }) =>
    apiFetch<EconomicEvent[]>(`/economic-events${qs(params)}`),
};
