import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./system-map.css";
import { t } from "@lingui/core/macro";
import { Maximize2, Move, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import {
  MAP_EDGES,
  MAP_NODES,
  WATCH_NODE_ID,
  defaultMapLayout,
  loadMapLayout,
  saveMapLayout,
  type MapLayoutPositions,
  type MapNodeId,
  type RuleClarity,
  nodeClarity,
  nodeSummaryLine,
} from "@/lib/system-map";
import { FeedbackEdge } from "./FeedbackEdge";
import {
  SystemNode,
  WatchNode,
  clarityLabel,
  clarityTone,
  systemNodeTitle,
  type SystemMapNode,
  type WatchMapNode,
} from "./SystemNode";

const nodeTypes: NodeTypes = { system: SystemNode, watch: WatchNode };
const edgeTypes: EdgeTypes = { feedback: FeedbackEdge };

function edgeLabel(key: (typeof MAP_EDGES)[number]["labelKey"]): string | undefined {
  switch (key) {
    case "confirm_trigger":
      return t`Confirm trigger`;
    case "keep_watching":
      return t`Conditions not met`;
    case "feedback":
      return t`Feedback to rules`;
    default:
      return undefined;
  }
}

const FIT_PADDING = 0.16;

function MapLegend() {
  const items: RuleClarity[] = ["self_clear", "needs_clarity", "empty"];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-14">
      <ul className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 rounded-full bg-card/85 px-3 py-1.5 text-2xs text-muted-foreground shadow-sm backdrop-blur-sm">
        {items.map((c) => (
          <li key={c} className="inline-flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", clarityTone(c).dot)} aria-hidden />
            {clarityLabel(c)}
          </li>
        ))}
        <li className="hidden items-center gap-1.5 text-muted-foreground/80 lg:inline-flex">
          <Move className="size-3" aria-hidden />
          {t`Drag to rearrange`}
        </li>
      </ul>
    </div>
  );
}

function sameLayout(a: MapLayoutPositions, b: MapLayoutPositions): boolean {
  return Object.keys(b).every(
    (k) => Math.round(a[k]?.x ?? NaN) === b[k]!.x && Math.round(a[k]?.y ?? NaN) === b[k]!.y,
  );
}

function positionsFromNodes(nodes: Node[]): MapLayoutPositions {
  const out: MapLayoutPositions = {};
  for (const n of nodes) out[n.id] = { x: n.position.x, y: n.position.y };
  return out;
}

function MapInner({
  systemId,
  rules,
  openQuestions,
  selected,
  onSelect,
}: {
  systemId: string;
  rules: Partial<Record<DecisionId, Rule>> | undefined;
  openQuestions: Partial<Record<SystemPart, string>> | undefined;
  selected: MapNodeId | null;
  onSelect: (id: MapNodeId) => void;
}) {
  const { fitView } = useReactFlow();
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<MapLayoutPositions>(() => loadMapLayout(systemId));

  const nodes: Node[] = (() => {
    const systemNodes: SystemMapNode[] = MAP_NODES.map((n) => {
      const clarity = nodeClarity(n.id, rules, openQuestions);
      const filled = n.decisions.filter((d) => (rules?.[d]?.text ?? "").trim()).length;
      const title = systemNodeTitle(n.id);
      return {
        id: n.id,
        type: "system",
        position: layout[n.id] ?? defaultMapLayout()[n.id],
        ariaLabel: t`${title}: ${clarityLabel(clarity)}, ${filled} of ${n.decisions.length} written`,
        data: {
          nodeId: n.id,
          title,
          summary: nodeSummaryLine(n.id, rules),
          filled,
          total: n.decisions.length,
          clarity,
          selected: selected === n.id,
        },
        selected: selected === n.id,
        draggable: true,
        connectable: false,
        deletable: false,
      };
    });

    const watch: WatchMapNode = {
      id: WATCH_NODE_ID,
      type: "watch",
      position: layout[WATCH_NODE_ID] ?? defaultMapLayout()[WATCH_NODE_ID],
      data: {
        title: t`Keep watching`,
        detail: t`Not a failure — wait for the trigger`,
      },
      draggable: true,
      connectable: false,
      deletable: false,
      selectable: true,
    };

    return [...systemNodes, watch];
  })();

  const edges: Edge[] = MAP_EDGES.map((e) => {
    const label = edgeLabel(e.labelKey);
    const isBranch = e.kind === "branch";
    const isFeedback = e.kind === "feedback";
    const target = isBranch ? WATCH_NODE_ID : e.target;
    const sourceHandle = isFeedback ? "left-source" : e.sourceHandle;
    const touches =
      selected != null &&
      (e.source === selected || e.target === selected || (isBranch && selected === "entry"));
    const opacity = touches ? 0.9 : isBranch || isFeedback ? 0.4 : 0.5;
    return {
      id: e.id,
      source: e.source,
      target,
      sourceHandle,
      targetHandle: e.targetHandle,
      type: isFeedback ? "feedback" : "smoothstep",
      animated: false,
      label: isFeedback ? undefined : label,
      data: isFeedback ? { label } : undefined,
      labelStyle: { fill: "var(--color-muted-foreground)", fontSize: 11 },
      labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.92 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
      style: {
        stroke: "var(--color-muted-foreground)",
        strokeOpacity: opacity,
        strokeWidth: touches ? 1.75 : 1.5,
        transition: "stroke-opacity 150ms ease-out",
        strokeDasharray: isBranch || isFeedback ? "6 4" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: `color-mix(in oklab, var(--color-muted-foreground) ${Math.round(opacity * 100)}%, transparent)`,
      },
    };
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView({ padding: FIT_PADDING }));
    return () => cancelAnimationFrame(id);
  }, [fitView]);

  const selectNode = (id: string) => {
    const next = id === WATCH_NODE_ID ? "entry" : (id as MapNodeId);
    if (next !== selected) onSelect(next);
  };

  const onNodesChange = (changes: NodeChange[]) => {
    const picked = changes.find((c) => c.type === "select" && c.selected);
    if (picked && "id" in picked) selectNode(picked.id);
    const moved = changes.filter(
      (c): c is NodeChange & { type: "position"; position?: { x: number; y: number } } =>
        c.type === "position",
    );
    if (!moved.length) return;
    setLayout((prev) => {
      const next = { ...prev };
      for (const c of moved) {
        if (c.position) next[c.id] = { x: c.position.x, y: c.position.y };
      }
      return next;
    });
  };

  const persistLayout = (next: MapLayoutPositions) => {
    setLayout(next);
    saveMapLayout(systemId, next);
  };

  const resetLayout = () => {
    const next = defaultMapLayout();
    persistLayout(next);
    requestAnimationFrame(() =>
      fitView({ padding: FIT_PADDING, duration: reduceMotion ? 0 : 200 }),
    );
  };

  const isDefaultLayout = sameLayout(layout, defaultMapLayout());

  return (
    <div className="relative h-full min-h-[min(520px,60vh)] w-full overflow-hidden bg-transparent">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, _node, all) => {
          persistLayout({ ...layout, ...positionsFromNodes(all) });
        }}
        onNodeClick={(_, n) => selectNode(n.id)}
        aria-label={t`Trading system map`}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        fitView
        minZoom={0.45}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
        className="system-map-flow bg-transparent"
        style={{ background: "transparent" }}
      >
        {/* Dot grid is painted by .system-workspace so map + inspector share one void. */}
        <Background gap={20} size={0} color="transparent" />
        <Controls showInteractive={false} showFitView={false} position="bottom-left" />
      </ReactFlow>
      <div className="absolute end-3 top-3 z-10 flex items-center gap-0.5 rounded-lg bg-card/85 p-0.5 shadow-sm backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isDefaultLayout}
          onClick={resetLayout}
          title={t`Put every node back in its original place`}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t`Reset layout`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void fitView({ padding: FIT_PADDING, duration: reduceMotion ? 0 : 200 })}
          title={t`Fit the whole map in view`}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          {t`Fit`}
        </Button>
      </div>
      <MapLegend />
    </div>
  );
}

export function SystemMap(props: {
  systemId: string;
  rules: Partial<Record<DecisionId, Rule>> | undefined;
  openQuestions: Partial<Record<SystemPart, string>> | undefined;
  selected: MapNodeId | null;
  onSelect: (id: MapNodeId) => void;
}) {
  return (
    <ReactFlowProvider>
      <MapInner key={props.systemId} {...props} />
    </ReactFlowProvider>
  );
}
