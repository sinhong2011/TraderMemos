import { apiFetch } from "./client";
import type { Setup } from "./types";

interface SetupBody {
  name: string;
  description?: string;
}

export const setupsApi = {
  list: () => apiFetch<Setup[]>("/setups"),
  get: (id: string) => apiFetch<Setup>(`/setups/${id}`),
  create: (body: SetupBody) =>
    apiFetch<Setup>("/setups", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<SetupBody>) =>
    apiFetch<Setup>(`/setups/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/setups/${id}`, { method: "DELETE" }),
};
