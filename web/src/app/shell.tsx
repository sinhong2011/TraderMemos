import { Outlet } from "@tanstack/react-router";
import { AppNav } from "../components/AppNav";
import { HeaderBar } from "../components/HeaderBar";
import { Toaster } from "../components/Toaster";
import { ToolboxRail } from "../components/ToolboxRail";
import { useAuth } from "../lib/auth";
import { NewNoteDrawer } from "./drawers/NewNoteDrawer";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { LoginScreen } from "./screens/LoginScreen";

export function AppShell() {
	const authed = useAuth((s) => s.authed);

	if (!authed) {
		return <LoginScreen />;
	}

	return (
		<Toaster>
			<div className="signal-app relative flex h-full">
				<div className="signal-app-grain" aria-hidden />
				<AppNav />

				<div className="relative z-[1] m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden border border-border-strong bg-bg shadow-hard">
					<HeaderBar />
					<div className="flex min-h-0 flex-1 overflow-hidden">
						<ToolboxRail />
						<main className="min-h-0 min-w-0 flex-1 overflow-auto">
							<Outlet />
						</main>
					</div>
				</div>

				<NewTradeDrawer />
				<NewSetupDrawer />
				<NewNoteDrawer />
			</div>
		</Toaster>
	);
}
