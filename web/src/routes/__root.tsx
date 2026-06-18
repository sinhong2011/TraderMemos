import { createRootRoute } from "@tanstack/react-router";
import { AppShell } from "../app/shell";

export const Route = createRootRoute({
	component: AppShell,
});
