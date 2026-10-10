import type { ReactNode } from "react";

/** Map + inspector share one dotted surface (same level as the draft). */
export function WorkspaceGrid({
  map,
  list,
  inspector,
}: {
  map: ReactNode;
  /** Stacked node list shown instead of the canvas on narrow screens. */
  list: ReactNode;
  inspector: ReactNode;
}) {
  return (
    <div className="system-workspace grid min-h-[min(640px,70vh)] flex-1 overflow-hidden rounded-lg lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="relative min-h-[min(520px,55vh)] min-w-0 lg:min-h-0">
        <div className="absolute inset-0 hidden md:block">{map}</div>
        <div className="p-3 md:hidden">{list}</div>
      </div>
      <div className="min-h-[320px] min-w-0 p-3 lg:min-h-0 lg:ps-0">{inspector}</div>
    </div>
  );
}
