import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias — the page moved to /home; keep old bookmarks working.
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/home", replace: true });
  },
});
