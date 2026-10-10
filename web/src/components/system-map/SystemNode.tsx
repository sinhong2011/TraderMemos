import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { t } from "@lingui/core/macro";
import { cn } from "@/lib/cn";
import type { MapNodeId, RuleClarity } from "@/lib/system-map";

export type SystemMapNodeData = {
  nodeId: MapNodeId;
  title: string;
  summary: string;
  clarity: RuleClarity;
  selected: boolean;
};

export type SystemMapNode = Node<SystemMapNodeData, "system">;

export function systemNodeTitle(id: MapNodeId): string {
  switch (id) {
    case "market":
      return t`Market`;
    case "entry":
      return t`Entry`;
    case "risk":
      return t`Risk & size`;
    case "holding":
      return t`Holding`;
    case "review":
      return t`Review`;
  }
}

export function clarityLabel(c: RuleClarity): string {
  switch (c) {
    case "empty":
      return t`Not written`;
    case "needs_clarity":
      return t`Needs clarity`;
    case "self_clear":
      return t`Self-checked clear`;
  }
}

export function SystemNode({ data }: NodeProps<SystemMapNode>) {
  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[200px] rounded-lg bg-card px-3 py-2.5 shadow-sm",
        "ring-1 ring-transparent transition-[box-shadow,ring-color] duration-150",
        data.selected && "ring-2 ring-primary",
        data.clarity === "needs_clarity" && !data.selected && "ring-1 ring-amber-500/60",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground/40 !size-2" />
      <div className="text-sm font-medium text-foreground">{data.title}</div>
      <div className="mt-0.5 text-2xs text-muted-foreground">{clarityLabel(data.clarity)}</div>
      {data.summary ? (
        <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">{data.summary}</p>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground/40 !size-2" />
    </div>
  );
}
