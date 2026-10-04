import { createFileRoute, redirect } from "@tanstack/react-router";
import { marketTodayKey } from "@/lib/today";

/** Stable link for the rail and hotkeys: resolves to the day review for today. */
export const Route = createFileRoute("/today")({
  beforeLoad: () => {
    throw redirect({ to: "/day/$date", params: { date: marketTodayKey() }, replace: true });
  },
});
