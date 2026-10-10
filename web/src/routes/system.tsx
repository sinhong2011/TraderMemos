import { createFileRoute } from "@tanstack/react-router";
import { SystemView } from "@/app/screens/SystemView";
import { isMapNodeId, type MapNodeId } from "@/lib/system-map";

export type SystemSearch = {
  node?: MapNodeId;
  version?: string;
};

export function validateSystemSearch(raw: Record<string, unknown>): SystemSearch {
  const node = typeof raw.node === "string" && isMapNodeId(raw.node) ? raw.node : undefined;
  const version = typeof raw.version === "string" && raw.version ? raw.version : undefined;
  return { node, version };
}

export const Route = createFileRoute("/system")({
  validateSearch: validateSystemSearch,
  component: SystemView,
});
