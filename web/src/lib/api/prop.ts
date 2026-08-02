import { apiFetch, qs } from "./client";

export type DrawdownMode = "trailing" | "eod" | "static";

export interface PropSettings {
  profit_target: number | null;
  max_drawdown: number | null;
  drawdown_mode: DrawdownMode;
  daily_loss_limit: number | null;
  consistency_pct: number | null;
}

export interface PropStatus {
  equity: number;
  start_balance: number;
  realized_pnl: number;
  trading_days: number;
  profit_target?: number;
  target_pct?: number;
  max_drawdown?: number;
  drawdown_mode?: DrawdownMode;
  equity_floor?: number;
  floor_distance?: number;
  drawdown_hit: boolean;
  daily_loss_hits: number;
  best_day_pnl: number;
  best_day_share?: number;
  consistency_ok?: boolean;
  target_reached: boolean;
}

export interface PropStatusResponse {
  configured: boolean;
  settings?: PropSettings;
  status?: PropStatus;
}

export const propApi = {
  getSettings: (accountId: string) =>
    apiFetch<PropSettings>(`/accounts/${accountId}/prop-settings`),
  putSettings: (accountId: string, body: PropSettings) =>
    apiFetch<PropSettings>(`/accounts/${accountId}/prop-settings`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSettings: (accountId: string) =>
    apiFetch<void>(`/accounts/${accountId}/prop-settings`, { method: "DELETE" }),
  status: (accountId: string, tz?: string) =>
    apiFetch<PropStatusResponse>(`/accounts/${accountId}/prop-status${qs({ tz })}`),
};
