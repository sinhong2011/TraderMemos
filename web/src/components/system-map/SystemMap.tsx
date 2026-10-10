import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { t } from "@lingui/core/macro";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import {
  MAP_EDGES,
  MAP_NODES,
  MAP_POSITIONS,
  WATCH_NODE_ID,
  WATCH_POSITION,
  type MapNodeId,
  nodeClarity,
  nodeSummaryLine,
} from "@/lib/system-map";
import {
  SystemNode,
  WatchNode,
  systemNodeTitle,
  type SystemMapNode,
  type WatchMapNode,
} from "./SystemNode";

const nodeTypes: NodeTypes = { system: SystemNode, watch: WatchNode };

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
    </ul>
  );
}

function MapInner({
  rules,
  openQuestions,
  selected,
  onSelect,
}: {
  rules: Partial<Record<DecisionId, Rule>> | undefined;
  openQuestions: Partial<Record<SystemPart, string>> | undefined;
  selected: MapNodeId | null;
  onSelect: (id: MapNodeId) => void;
}) {
  const { fitView } = useReactFlow();
  const nodes: Node[] = useMemo(() => {
    const systemNodes: SystemMapNode[] = MAP_NODES.map((n) => {
      const clarity = nodeClarity(n.id, rules, openQuestions);
      const filled = n.decisions.filter((d) => (rules?.[d]?.text ?? "").trim()).length;
      const line = nodeSummaryLine(n.id, rules);
      const summary = line || t`${filled} of ${n.decisions.length} written`;
      return {
        id: n.id,
        type: "system",
        position: MAP_POSITIONS[n.id],
        data: {
          nodeId: n.id,
          title: systemNodeTitle(n.id),
          summary,
          clarity,
          selected: selected === n.id,
        },
        selected: selected === n.id,
        draggable: false,
        connectable: false,
        deletable: false,
      };
    });

    const watch: WatchMapNode = {
      id: WATCH_NODE_ID,
      type: "watch",
      position: WATCH_POSITION,
      data: {
        title: t`Keep watching`,
        detail: t`Not a failure — wait for the trigger`,
      },
      draggable: false,
      connectable: false,
      deletable: false,
      selectable: false,
    };

    return [...systemNodes, watch];
  }, [rules, openQuestions, selected]);

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
          type: isFeedback ? "default" : "smoothstep",
          animated: false,
          label,
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
    const id = requestAnimationFrame(() => fitView({ padding: 0.16 }));
    return () => cancelAnimationFrame(id);
  }, [fitView]);

  return (
    <div className="relative h-[min(640px,70vh)] w-full overflow-hidden rounded-lg bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => {
          if (n.id === WATCH_NODE_ID) {
            onSelect("entry");
            return;
          }
          onSelect(n.id as MapNodeId);
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        fitView
        minZoom={0.45}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
        className="system-map-flow"
      >
        <Background gap={22} size={1} color="var(--color-border)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className="absolute end-3 top-3 z-10">
        <FitButton />
      </div>
      <MapLegend />
    </div>
  );
}

export function SystemMap(props: {
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
