import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { t } from "@lingui/core/macro";

export type FeedbackEdgeType = Edge<{ label?: string }, "feedback">;

/**
 * Review → Market loop bowing to the left so the label sits off the
 * vertical spine instead of overlapping a collapsed dashed connector.
 */
export function FeedbackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}: EdgeProps<FeedbackEdgeType>) {
  const outward = Math.max(96, Math.abs(sourceY - targetY) * 0.22);
  const loopX = Math.min(sourceX, targetX) - outward;
  const path = `M ${sourceX},${sourceY} C ${loopX},${sourceY} ${loopX},${targetY} ${targetX},${targetY}`;
  const lx = loopX;
  const ly = (sourceY + targetY) / 2;
  const label = data?.label ?? t`Feedback to rules`;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute origin-center rounded-md bg-card/90 px-1.5 py-0.5 text-2xs whitespace-nowrap text-muted-foreground"
          style={{
            transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
