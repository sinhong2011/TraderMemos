import { Outlet } from "@tanstack/react-router";
import { AppNav } from "../components/AppNav";
import { HeaderBar } from "../components/HeaderBar";
import { Toaster } from "../components/Toaster";
import { useAuth } from "../lib/auth";
import { useUI } from "../lib/ui";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { LoginScreen } from "./screens/LoginScreen";

export function AppShell() {
	const authed = useAuth((s) => s.authed);
	const collapsed = useUI((s) => s.sidebarCollapsed);

	if (!authed) {
		return <LoginScreen />;
	}

	return (
		<div
			className="flex h-full"
			style={{ background: "var(--color-surface-base)" }}
		>
			{!collapsed && <AppNav />}

			<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
				<HeaderBar />
				<main
					className="flex-1 overflow-auto p-4"
					style={{ background: "var(--color-surface-base)" }}
				>
					<Outlet />
				</main>
			</div>

			<NewTradeDrawer />
			<NewSetupDrawer />
			<Toaster />
		</div>
	);
}
