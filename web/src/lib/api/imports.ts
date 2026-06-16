import { apiFetch } from "./client";
import type { ImportBatch, ImportPreview, ImportResult } from "./types";

export const importsApi = {
  // Step 1: upload CSV + account_id → preview with suggested mapping
  preview: (formData: FormData) =>
    apiFetch<ImportPreview>("/imports", { method: "POST", body: formData }),
  // Step 2: commit with file + column_mapping JSON string
  commit: (id: string, formData: FormData) =>
    apiFetch<ImportResult>(`/imports/${id}/commit`, { method: "POST", body: formData }),
  list: () => apiFetch<ImportBatch[]>("/imports"),
  delete: (id: string) => apiFetch<void>(`/imports/${id}`, { method: "DELETE" }),
};
