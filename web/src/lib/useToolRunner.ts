import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { ToolId } from "./tools";
import { useUI } from "./ui";

export function useToolRunner() {
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
        case "chart":
          void navigate({ to: "/chart", search: { iv: "D" } });
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
      }
    },
    [navigate, openFx, openKelly, openPositionSize],
  );
}
