import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { t } from "@lingui/core/macro";
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ClipboardList,
  Crosshair,
  Eye,
  Gauge,
  RefreshCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { checkLabel, checkTone, type CheckState, type NodeCheck } from "@/lib/system-plan";
import type { MapNodeId, RuleClarity } from "@/lib/system-map";

export type SystemMapNodeData = {
  nodeId: MapNodeId;
  title: string;
  summary: string;
  filled: number;
  total: number;
  clarity: RuleClarity;
  selected: boolean;
  /** Present while following a plan: the plan's answers replace rule clarity. */
  check?: NodeCheck;
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

const NODE_ICONS: Record<MapNodeId, LucideIcon> = {
  market: BarChart3,
  entry: Crosshair,
  risk: Gauge,
  holding: ClipboardList,
  review: RefreshCcw,
};

export function NodeIcon({ id, className }: { id: MapNodeId; className?: string }) {
  const Glyph = NODE_ICONS[id];
  return <Glyph className={className} aria-hidden />;
}

/** Status hue: success = clear, warning = needs work, muted = untouched. Primary is reserved for selection. */
export function clarityTone(c: RuleClarity): { text: string; dot: string } {
  switch (c) {
    case "self_clear":
      return { text: "text-success-foreground", dot: "bg-success" };
    case "needs_clarity":
      return { text: "text-warning-foreground", dot: "bg-warning" };
    case "empty":
      return { text: "text-muted-foreground", dot: "bg-muted-foreground/50" };
  }
}

export function StatusIcon({ clarity, className }: { clarity: RuleClarity; className?: string }) {
  const tone = clarityTone(clarity).text;
  const cls = cn("size-3.5 shrink-0", tone, className);
  if (clarity === "self_clear") return <CheckCircle2 className={cls} aria-hidden />;
  if (clarity === "needs_clarity") return <CircleAlert className={cls} aria-hidden />;
  return <CircleDashed className={cls} aria-hidden />;
}

export function CheckIcon({ state, className }: { state: CheckState; className?: string }) {
  const cls = cn("size-3.5 shrink-0", checkTone(state).text, className);
  if (state === "met") return <CheckCircle2 className={cls} aria-hidden />;
  if (state === "not_met") return <XCircle className={cls} aria-hidden />;
  return <CircleDashed className={cls} aria-hidden />;
}

export function CheckPill({ check }: { check: NodeCheck }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
        checkTone(check.state).pill,
      )}
    >
      <CheckIcon state={check.state} className="size-3" />
      {checkLabel(check.state)}
    </span>
  );
}

export function ClarityPill({ clarity }: { clarity: RuleClarity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
        clarity === "self_clear" && "bg-success/10 text-success-foreground",
        clarity === "needs_clarity" && "bg-warning/10 text-warning-foreground",
        clarity === "empty" && "bg-muted text-muted-foreground",
      )}
    >
      <StatusIcon clarity={clarity} className="size-3" />
      {clarityLabel(clarity)}
    </span>
  );
}

export function NodeProgress({ filled, total }: { filled: number; total: number }) {
  return (
    <span
      className="text-2xs font-medium tabular-nums text-muted-foreground"
      aria-label={t`${filled} of ${total} decisions written`}
    >
      {filled}/{total}
    </span>
  );
}

/** Handles route edges only; nodes are not user-connectable, so keep them invisible. */
const handleCls = "!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-transparent";

export function SystemNode({ data }: NodeProps<SystemMapNode>) {
  return (
    <div
      className={cn(
        "group w-[280px] rounded-xl bg-card px-3.5 py-3 shadow-sm",
        "transition-[box-shadow,transform] duration-150 ease-out motion-reduce:transition-none",
        "hover:shadow-md",
        data.selected && "shadow-md ring-2 ring-primary",
      )}
    >
      <Handle type="target" position={Position.Top} id="top" className={handleCls} />
      {data.nodeId === "market" ? (
        <Handle type="target" position={Position.Left} id="left" className={handleCls} />
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
            data.selected
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground group-hover:text-foreground",
          )}
        >
          <NodeIcon id={data.nodeId} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold text-foreground">{data.title}</div>
            {data.check ? (
              <span
                className="text-2xs font-medium tabular-nums text-muted-foreground"
                aria-label={t`${data.check.answered} of ${data.check.total} checked`}
              >
                {data.check.answered}/{data.check.total}
              </span>
            ) : (
              <NodeProgress filled={data.filled} total={data.total} />
            )}
          </div>
          {data.check ? (
            <div
              className={cn(
                "mt-0.5 flex items-center gap-1.5 text-2xs font-medium",
                checkTone(data.check.state).text,
              )}
            >
              <CheckIcon state={data.check.state} />
              <span>{checkLabel(data.check.state)}</span>
            </div>
          ) : (
            <div
              className={cn(
                "mt-0.5 flex items-center gap-1.5 text-2xs font-medium",
                clarityTone(data.clarity).text,
              )}
            >
              <StatusIcon clarity={data.clarity} />
              <span>{clarityLabel(data.clarity)}</span>
            </div>
          )}
          <p
            className={cn(
              "mt-1.5 line-clamp-2 text-2xs leading-snug",
              data.summary ? "text-muted-foreground" : "text-muted-foreground/70",
            )}
          >
            {data.summary || t`No rule yet — select to write one.`}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" className={handleCls} />
      {data.nodeId === "entry" ? (
        <Handle type="source" position={Position.Right} id="right" className={handleCls} />
      ) : null}
      {data.nodeId === "review" ? (
        <Handle type="source" position={Position.Left} id="left-source" className={handleCls} />
      ) : null}
    </div>
  );
}

/** Side branch: conditions not met → keep watching. */
export function WatchNode({ data }: NodeProps<WatchMapNode>) {
  return (
    <div className="group flex w-[156px] flex-col items-center gap-1.5">
      <Handle type="target" position={Position.Left} id="left" className={handleCls} />
      <div className="flex size-11 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-card text-muted-foreground transition-colors duration-150 group-hover:text-foreground motion-reduce:transition-none">
        <Eye className="size-4.5" aria-hidden />
      </div>
      <div className="text-center text-2xs font-semibold text-foreground">{data.title}</div>
      <div className="text-center text-2xs leading-snug text-muted-foreground">{data.detail}</div>
    </div>
  );
}
