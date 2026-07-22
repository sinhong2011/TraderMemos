import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout route for /trades and /trades/$id. Renders the matched child
// (the trades list at the index, or the trade detail) via Outlet.
export const Route = createFileRoute("/trades")({
  component: () => <Outlet />,
});
