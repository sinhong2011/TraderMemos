import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { t } from "@lingui/core/macro";
import {
  BarChart3,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock3,
  Crosshair,
  Gauge,
  type LucideIcon,
} from "lucide-react";
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

export type WatchMapNodeData = {
  title: string;
  detail: string;
};

export type WatchMapNode = Node<WatchMapNodeData, "watch">;

export function systemNodeTitle(id: MapNodeId): string {
  switch (id) {
    case "market":
      return t`Market environment`;
    case "entry":
      return t`Entry conditions`;
    case "risk":
      return t`Risk & position`;
    case "holding":
      return t`Holding decisions`;
    case "review":
      return t`Review & adjust`;
  }
}

export function clarityLabel(c: RuleClarity): string {
  switch (c) {
    case "empty":
      return t`Not written`;
    case "needs_clarity":
      return t`Needs clarity`;
    case "self_clear":
      return t`Clear`;
  }
}

function nodeIcon(id: MapNodeId): LucideIcon {
  switch (id) {
    case "market":
      return BarChart3;
    case "entry":
      return Crosshair;
    case "risk":
      return Gauge;
    case "holding":
      return ClipboardList;
    case "review":
      return BarChart3;
  }
}

function StatusIcon({ clarity }: { clarity: RuleClarity }) {
  if (clarity === "self_clear") return <CheckCircle2 className="size-3.5 text-success" />;
  if (clarity === "needs_clarity") return <Clock3 className="size-3.5 text-primary" />;
  return <CircleDashed className="size-3.5 text-muted-foreground" />;
}

export function SystemNode({ data }: NodeProps<SystemMapNode>) {
  const Icon = nodeIcon(data.nodeId);
  return (
    <div
      className={cn(
        "w-[280px] rounded-xl bg-card px-3.5 py-3 shadow-sm",
        "ring-1 ring-border/60 transition-[box-shadow,ring-color] duration-150",
        data.selected && "ring-2 ring-primary shadow-md",
        data.clarity === "needs_clarity" && !data.selected && "ring-primary/50",
        data.clarity === "self_clear" && !data.selected && "ring-success/40",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            data.selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{data.title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <StatusIcon clarity={data.clarity} />
            <span>{clarityLabel(data.clarity)}</span>
          </div>
          {data.summary ? (
            <p className="mt-1.5 line-clamp-2 text-2xs leading-snug text-muted-foreground">
              {data.summary}
            </p>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
    </div>
  );
}

/** Side branch: conditions not met → keep watching. */
export function WatchNode({ data }: NodeProps<WatchMapNode>) {
  return (
    <div className="flex w-[148px] flex-col items-center gap-1.5">
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!size-2 !border-border !bg-muted-foreground/50"
      />
      <div className="flex size-12 items-center justify-center rounded-full bg-card ring-1 ring-border/60">
        <CircleDashed className="size-5 text-muted-foreground" />
      </div>
      <div className="text-center text-2xs font-medium text-foreground">{data.title}</div>
      <div className="text-center text-2xs text-muted-foreground">{data.detail}</div>
    </div>
  );
}
