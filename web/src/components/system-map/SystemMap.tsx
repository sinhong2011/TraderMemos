import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { t } from "@lingui/core/macro";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { MAP_EDGES, MAP_NODES, MAP_POSITIONS, type MapNodeId, nodeClarity } from "@/lib/system-map";
import { SystemNode, systemNodeTitle, type SystemMapNode } from "./SystemNode";

const nodeTypes: NodeTypes = { system: SystemNode };

function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => fitView({ padding: 0.2 })}>
      {t`Fit`}
    </Button>
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
  const nodes: SystemMapNode[] = useMemo(
    () =>
      MAP_NODES.map((n) => {
        const clarity = nodeClarity(n.id, rules, openQuestions);
        const filled = n.decisions.filter((d) => (rules?.[d]?.text ?? "").trim()).length;
        return {
          id: n.id,
          type: "system",
          position: MAP_POSITIONS[n.id],
          data: {
            nodeId: n.id,
            title: systemNodeTitle(n.id),
            summary: t`${filled} of ${n.decisions.length} written`,
            clarity,
            selected: selected === n.id,
          },
          selected: selected === n.id,
          draggable: false,
          connectable: false,
          deletable: false,
        };
      }),
    [rules, openQuestions, selected],
  );

  const edges: Edge[] = useMemo(
    () =>
      MAP_EDGES.filter((e) => e.source !== e.target).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
        style: { stroke: "var(--color-muted-foreground)", strokeOpacity: 0.35 },
      })),
    [],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ padding: 0.2 }));
    return () => cancelAnimationFrame(id);
  }, [fitView]);

  return (
    <div className="relative h-[min(420px,50vh)] w-full overflow-hidden rounded-lg bg-muted/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => onSelect(n.id as MapNodeId)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        fitView
        proOptions={{ hideAttribution: true }}
        className="system-map-flow"
      >
        <Background gap={20} size={1} color="var(--color-border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="absolute end-3 top-3">
        <FitButton />
      </div>
      <p className="pointer-events-none absolute bottom-3 start-3 text-2xs text-muted-foreground">
        {t`Conditions not met → keep watching is a branch of Entry, not a failure.`}
      </p>
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
