import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useToastManager } from "@/components/Toast";
import { TOOL_ITEMS, type ToolId } from "./tools";
import { useUI } from "./ui";

export function useToolRunner() {
  const toast = useToastManager();
  const navigate = useNavigate();
  const openPositionSize = useUI((s) => s.openPositionSize);

  return useCallback(
    (id: ToolId) => {
      switch (id) {
        case "size":
          openPositionSize();
          return;
        case "today":
          navigate({ to: "/calendar" });
          return;
        case "wrapped":
          void navigate({ to: "/wrapped", search: { year: new Date().getFullYear() } });
          return;
        case "wallet":
          toast.add({
            title: "Wallet",
            description: "Account cash is shown in the header stat strip.",
          });
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
    [navigate, openPositionSize, toast],
  );
}
