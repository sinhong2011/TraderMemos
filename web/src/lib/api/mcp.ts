import { apiFetch } from "./client";

/** Per-account switches for the MCP endpoint (external AI assistants). */
export interface McpSettings {
  /** False when the server runs with TM_MCP_ENABLED=false. */
  available: boolean;
  enabled: boolean;
  allow_writes: boolean;
  /** Path of the endpoint on the API origin, e.g. `/api/v1/mcp`. */
  endpoint_path: string;
  updated_at?: string;
}

export interface PutMcpSettingsBody {
  enabled: boolean;
  allow_writes: boolean;
}

export const mcpApi = {
  getSettings: () => apiFetch<McpSettings>("/settings/mcp"),
  putSettings: (body: PutMcpSettingsBody) =>
    apiFetch<McpSettings>("/settings/mcp", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
