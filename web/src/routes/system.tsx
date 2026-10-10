import { createFileRoute } from "@tanstack/react-router";
import { SystemView } from "@/app/screens/SystemView";
import { isMapNodeId, type MapNodeId } from "@/lib/system-map";

export type SystemMode = "rules" | "follow" | "review";

export type SystemSearch = {
  mode?: SystemMode;
  node?: MapNodeId;
  version?: string;
};

export function isSystemMode(v: string | null | undefined): v is SystemMode {
  return v === "rules" || v === "follow" || v === "review";
}

export function validateSystemSearch(raw: Record<string, unknown>): SystemSearch {
  const mode = typeof raw.mode === "string" && isSystemMode(raw.mode) ? raw.mode : undefined;
  const node = typeof raw.node === "string" && isMapNodeId(raw.node) ? raw.node : undefined;
  const version = typeof raw.version === "string" && raw.version ? raw.version : undefined;
  return { mode, node, version };
}

export const Route = createFileRoute("/system")({
  validateSearch: validateSystemSearch,
  component: SystemView,
});
