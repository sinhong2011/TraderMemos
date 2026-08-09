import { apiFetch, publicFetch } from "./client";

export interface ShareScope {
  account_id?: string;
  from?: string;
  to?: string;
  tz?: string;
  show_amounts?: boolean;
  currency?: string;
}

export interface ShareLink {
  id: string;
  token: string;
  scope: ShareScope;
  created_at: string;
  expires_at: string | null;
  view_count: number;
}

export interface CreateShareLinkBody extends ShareScope {
  /** Omit for the 90-day default; 0 = never expires. */
  expires_in_days?: number;
}

export interface ShareSummary {
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  profit_factor: number;
  kelly_pct: number;
  sqn: number;
  // Present only when the link allows amounts.
  net_pnl?: number;
  gross_profit?: number;
  gross_loss?: number;
  expectancy?: number;
  avg_win?: number;
  avg_loss?: number;
  avg_trade?: number;
  largest_win?: number;
  largest_loss?: number;
  total_fees?: number;
}

export interface ShareEquityPoint {
  at: string;
  /** Cumulative net P&L; scaled to max |value| = 1 when amounts are hidden. */
  value: number;
}

export interface ShareMonth {
  month: string;
  trades: number;
  pnl?: number;
}

export interface ShareSymbol {
  symbol: string;
  trades: number;
  pnl?: number;
}

export interface PublicShareSummary {
  summary: ShareSummary;
  equity: ShareEquityPoint[];
  months: ShareMonth[];
  top_symbols: ShareSymbol[];
  trading_days: number;
  green_days: number;
  red_days: number;
  best_streak: number;
  worst_streak: number;
  first_day?: string;
  last_day?: string;
  best_day_pnl?: number;
  worst_day_pnl?: number;
  show_amounts: boolean;
  currency?: string;
}

export const shareApi = {
  list: () => apiFetch<ShareLink[]>("/share-links"),
  create: (body: CreateShareLinkBody) =>
    apiFetch<ShareLink>("/share-links", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revoke: (id: string) =>
    apiFetch<void>(`/share-links/${id}`, {
      method: "DELETE",
    }),
  getPublic: (token: string) =>
    publicFetch<PublicShareSummary>(`/public/share/${encodeURIComponent(token)}`),
};

/** The visitor-facing URL for a link, on this web app's origin. */
export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
