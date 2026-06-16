import { apiFetch, qs } from "./client";
import type { Tag } from "./types";

interface TagBody {
  name: string;
  color?: string;
  description?: string;
  kind?: string;
}

export const tagsApi = {
  list: (kind?: string) =>
    apiFetch<Tag[]>(`/tags${qs({ kind })}`),
  get: (id: string) => apiFetch<Tag>(`/tags/${id}`),
  create: (body: TagBody) =>
    apiFetch<Tag>("/tags", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<TagBody>) =>
    apiFetch<Tag>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/tags/${id}`, { method: "DELETE" }),
};
