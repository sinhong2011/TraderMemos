const BASE = import.meta.env.VITE_API ?? "http://localhost:8080/api/v1";
let token = localStorage.getItem("tm_token") ?? "";

export function setToken(t: string) {
  token = t;
  localStorage.setItem("tm_token", t);
}

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? res.statusText);
  }
  return res.json();
}

export interface Trade {
  id: string;
  symbol: string;
  direction: string;
  net_pnl: number | null;
  closed_at: string | null;
}

export const api = {
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  accounts: () => req("/accounts"),
  trades: (accountId: string): Promise<Trade[]> => req(`/trades?account_id=${accountId}`),
  summary: (accountId: string) => req(`/analytics/summary?account_id=${accountId}`),
};
