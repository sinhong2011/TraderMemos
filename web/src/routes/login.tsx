import { createFileRoute, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (getToken()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => null,
});
