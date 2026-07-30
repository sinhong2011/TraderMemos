import { createFileRoute, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/api/client";

export const Route = createFileRoute("/setup")({
  beforeLoad: () => {
    if (getToken()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => null,
});
