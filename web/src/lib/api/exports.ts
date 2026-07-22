import { ApiError, apiRawGet, qs } from "./client";
import type { ExportFormat } from "./exports.types";

export type { ExportFormat } from "./exports.types";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download unified account export (same data as JSON backup; CSV is journal view). */
export async function downloadExport(params: {
  format: ExportFormat;
  accountId: string;
  from?: string;
  to?: string;
}): Promise<void> {
  const path = `/exports${qs({
    account_id: params.accountId,
    format: params.format,
    from: params.from,
    to: params.to,
  })}`;

  const res = await apiRawGet(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? "error", e.message ?? res.statusText);
  }

  const fallback = `tradermemos-export.${params.format}`;
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition"), fallback);

  if (params.format === "json") {
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(blob, filename.endsWith(".json") ? filename : `${fallback}`);
    return;
  }

  const blob = await res.blob();
  triggerDownload(blob, filename);
}
