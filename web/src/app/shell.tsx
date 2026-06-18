import { Outlet } from "@tanstack/react-router";
import { AccountSwitcher } from "../components/AccountSwitcher";
import { AppNav } from "../components/AppNav";
import { DateRangePicker } from "../components/DateRangePicker";
import { Toaster } from "../components/Toaster";

export function AppShell() {
	return (
		<div
			className="flex h-full"
			style={{ background: "var(--color-surface-base)" }}
		>
			{/* Left sidebar nav */}
			<AppNav />

			{/* Main content column */}
			<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
				{/* Top bar */}
				<header
					className="flex items-center gap-3 px-4 py-2 shrink-0"
					style={{
						borderBottom: "1px solid var(--color-border)",
						background: "var(--color-surface-panel)",
						height: "44px",
					}}
				>
					<div className="ml-auto flex items-center gap-2">
						<DateRangePicker />
						<AccountSwitcher />
					</div>
				</header>

				{/* Page content */}
				<main
					className="flex-1 overflow-auto p-4"
					style={{ background: "var(--color-surface-base)" }}
				>
					<Outlet />
				</main>
			</div>

			{/* Toast notifications */}
			<Toaster />
		</div>
	);
}
