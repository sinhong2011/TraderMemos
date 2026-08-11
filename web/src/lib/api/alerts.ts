import { apiFetch } from "./client";

export interface AlertSettings {
  enabled: boolean;
  timezone: string;
  rule_risk: boolean;
  rule_daily_loss: boolean;
  rule_loss_streak: boolean;
  loss_streak_n: number;
  rule_prop_drawdown: boolean;
  prop_warn_pct: number;
  rule_unreviewed: boolean;
  unreviewed_days: number;
}

export interface AlertChannel {
  id: string;
  kind: "webhook" | "expo";
  target: string;
  label: string;
  enabled: boolean;
  last_sent_at: string | null;
  last_status: string;
  last_error: string;
}

export interface AlertEvent {
  id: string;
  rule: string;
  title: string;
  body: string;
  fired_at: string;
}

export interface AlertTestResult {
  ok: boolean;
  error?: string;
}

export const alertsApi = {
  getSettings: () => apiFetch<AlertSettings>("/settings/alerts"),
  putSettings: (body: AlertSettings) =>
    apiFetch<AlertSettings>("/settings/alerts", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  listChannels: () => apiFetch<AlertChannel[]>("/settings/alert-channels"),
  createWebhook: (body: { target: string; label?: string }) =>
    apiFetch<AlertChannel>("/settings/alert-channels", {
      method: "POST",
      body: JSON.stringify({ kind: "webhook", ...body }),
    }),
  setChannelEnabled: (id: string, enabled: boolean) =>
    apiFetch<AlertChannel>(`/settings/alert-channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  deleteChannel: (id: string) =>
    apiFetch<void>(`/settings/alert-channels/${id}`, { method: "DELETE" }),
  testChannel: (id: string) =>
    apiFetch<AlertTestResult>(`/settings/alert-channels/${id}/test`, {
      method: "POST",
    }),
  listEvents: (limit = 10) => apiFetch<AlertEvent[]>(`/alerts/events?limit=${limit}`),
};
