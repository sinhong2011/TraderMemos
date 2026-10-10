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
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  nodeClarity,
  nodeSummaryLine,
} from "@/lib/system-map";
import { FeedbackEdge } from "./FeedbackEdge";
import {
  SystemNode,
  WatchNode,
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

function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => fitView({ padding: 0.18 })}>
      {t`Fit`}
    </Button>
  );
}

function MapLegend() {
  return (
    <ul className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-success" />
        {t`Clear`}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" />
        {t`Needs clarity`}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        {t`Not written`}
      </li>
      <li className="text-muted-foreground/80">{t`Drag nodes to rearrange`}</li>
    </ul>
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
  const [layout, setLayout] = useState<MapLayoutPositions>(() => loadMapLayout(systemId));
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const didInitialFit = useRef(false);

  useEffect(() => {
    setLayout(loadMapLayout(systemId));
    didInitialFit.current = false;
  }, [systemId]);

  const nodes: Node[] = useMemo(() => {
    const systemNodes: SystemMapNode[] = MAP_NODES.map((n) => {
      const clarity = nodeClarity(n.id, rules, openQuestions);
      const filled = n.decisions.filter((d) => (rules?.[d]?.text ?? "").trim()).length;
      const line = nodeSummaryLine(n.id, rules);
      const summary = line || t`${filled} of ${n.decisions.length} written`;
      return {
        id: n.id,
        type: "system",
        position: layout[n.id] ?? defaultMapLayout()[n.id],
        data: {
          nodeId: n.id,
          title: systemNodeTitle(n.id),
          summary,
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
  }, [rules, openQuestions, selected, layout]);

  const edges: Edge[] = useMemo(
    () =>
      MAP_EDGES.map((e) => {
        const label = edgeLabel(e.labelKey);
        const isBranch = e.kind === "branch";
        const isFeedback = e.kind === "feedback";
        const target = isBranch ? WATCH_NODE_ID : e.target;
        const sourceHandle = isFeedback ? "left-source" : e.sourceHandle;
        return {
          id: e.id,
          source: e.source,
          target,
          sourceHandle,
          targetHandle: e.targetHandle,
          type: isFeedback ? "feedback" : "smoothstep",
          animated: false,
          // Feedback uses EdgeLabelRenderer inside FeedbackEdge — avoid the
          // default SVG label sitting on the collapsed left spine.
          label: isFeedback ? undefined : label,
          data: isFeedback ? { label } : undefined,
          labelStyle: { fill: "var(--color-muted-foreground)", fontSize: 11 },
          labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.92 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 6,
          style: {
            stroke: "var(--color-muted-foreground)",
            strokeOpacity: isBranch || isFeedback ? 0.45 : 0.55,
            strokeWidth: 1.5,
            strokeDasharray: isBranch || isFeedback ? "6 4" : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: "color-mix(in oklab, var(--color-muted-foreground) 55%, transparent)",
          },
        };
      }),
    [],
  );

  useEffect(() => {
    if (didInitialFit.current) return;
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.16 });
      didInitialFit.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [fitView, systemId]);

  const onNodesChange = (changes: NodeChange[]) => {
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
    requestAnimationFrame(() => fitView({ padding: 0.16 }));
  };

  return (
    <div className="relative h-full min-h-[min(520px,60vh)] w-full overflow-hidden bg-transparent">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, _node, all) => {
          persistLayout({ ...layoutRef.current, ...positionsFromNodes(all) });
        }}
        onNodeClick={(_, n) => {
          if (n.id === WATCH_NODE_ID) {
            onSelect("entry");
            return;
          }
          onSelect(n.id as MapNodeId);
        }}
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
      <div className="absolute end-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={resetLayout}>
          {t`Reset layout`}
        </Button>
        <FitButton />
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
      <MapInner {...props} />
    </ReactFlowProvider>
  );
}
