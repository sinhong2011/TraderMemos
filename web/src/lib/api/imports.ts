import { apiFetch } from "./client";
import type { ImportBatch, ImportPreview, ImportResult } from "./types";

export const importsApi = {
  // Step 1: parse-only preview (no DB writes)
  preview: (formData: FormData) =>
    apiFetch<ImportPreview>("/imports", { method: "POST", body: formData }),
  // Step 2: confirm — only write path (batch + fills). Pass empty id for fresh commit.
  commit: (id: string, formData: FormData) =>
    apiFetch<ImportResult>(id ? `/imports/${id}/commit` : "/imports/commit", {
      method: "POST",
      body: formData,
    }),
  list: () => apiFetch<ImportBatch[]>("/imports"),
  delete: (id: string) => apiFetch<void>(`/imports/${id}`, { method: "DELETE" }),
};
