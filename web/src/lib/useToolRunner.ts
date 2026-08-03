import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useToastManager } from "@/components/Toast";
import { TOOL_ITEMS, type ToolId } from "./tools";
import { useUI } from "./ui";

export function useToolRunner() {
  const toast = useToastManager();
  const navigate = useNavigate();
  const openPositionSize = useUI((s) => s.openPositionSize);
  const openKelly = useUI((s) => s.openKelly);
  const openFx = useUI((s) => s.openFx);

  return useCallback(
    (id: ToolId) => {
      switch (id) {
        case "size":
          openPositionSize();
          return;
        case "kelly":
          openKelly();
          return;
        case "fx":
          openFx();
          return;
        case "planner":
          void navigate({ to: "/calculator" });
          return;
        case "econ":
          void navigate({ to: "/events", search: { wk: 0 } });
          return;
        case "today":
          void navigate({ to: "/calendar" });
          return;
        case "wrapped":
          void navigate({ to: "/wrapped", search: { year: new Date().getFullYear() } });
          return;
        default: {
          const tool = TOOL_ITEMS.find((item) => item.id === id);
          toast.add({
            title: tool?.label ?? "Tool",
            description: "Coming soon in TraderMemos.",
          });
        }
      }
    },
    [navigate, openFx, openKelly, openPositionSize, toast],
  );
}
