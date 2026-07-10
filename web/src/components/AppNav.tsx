import { Link } from "@tanstack/react-router";
import {
	BookOpen,
	CalendarDays,
	CandlestickChart,
	LayoutDashboard,
	List,
	PieChart,
	Plus,
	Settings,
	Upload,
	Zap,
} from "lucide-react";
import { useUI } from "../lib/ui";
import { AccountSwitcher } from "./AccountSwitcher";

const ROUTER_ROUTES = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/reports", label: "Stats", icon: PieChart },
	{ to: "/calendar", label: "Calendar", icon: CalendarDays },
	{ to: "/trades", label: "Trades", icon: List },
	{ to: "/playbook", label: "Playbook", icon: BookOpen },
	{ to: "/import", label: "Import", icon: Upload },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

const itemBase: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	padding: "10px 14px",
	borderRadius: "var(--radius-control)",
	fontSize: "14px",
	textDecoration: "none",
	position: "relative",
	transition: "background var(--duration-fast), color var(--duration-fast)",
	cursor: "pointer",
};

function QuickAction({
	label,
	icon: Icon,
	color,
	onClick,
}: {
	label: string;
	icon: typeof Plus;
	color: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				...itemBase,
				color,
				background: "transparent",
				border: "none",
				width: "100%",
				textAlign: "left",
				fontFamily: "var(--font-ui)",
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLElement).style.background =
					"var(--color-surface-hover)";
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLElement).style.background = "transparent";
			}}
		>
			<Icon size={16} strokeWidth={1.75} />
			<span>{label}</span>
		</button>
	);
}

export function AppNav() {
	const openDrawer = useUI((s) => s.openDrawer);

	return (
		<nav
			aria-label="Main navigation"
			style={{
				width: "260px",
				background: "var(--color-surface-panel)",
				borderRight: "1px solid var(--color-border)",
				display: "flex",
				flexDirection: "column",
				gap: "2px",
				padding: "0 10px 12px",
				flexShrink: 0,
				overflowY: "auto",
			}}
		>
			{/* Wordmark */}
			<div
				className="flex items-center gap-2.5"
				style={{ padding: "18px 14px 16px", marginBottom: "2px" }}
			>
				<CandlestickChart
					size={22}
					strokeWidth={2}
					style={{ color: "var(--color-accent)" }}
				/>
				<span
					style={{
						fontSize: "17px",
						fontWeight: 700,
						letterSpacing: "-0.01em",
						color: "var(--color-text)",
					}}
				>
					TraderMemos
				</span>
			</div>

			{/* Account switcher */}
			<div style={{ padding: "0 4px", marginBottom: "14px" }}>
				<AccountSwitcher />
			</div>

			{/* Nav */}
			{ROUTER_ROUTES.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					style={itemBase}
					activeProps={{
						style: {
							...itemBase,
							color: "var(--color-accent)",
							background: "var(--color-accent-subtle)",
							boxShadow: "inset 3px 0 0 var(--color-accent)",
						},
					}}
					inactiveProps={{
						style: { ...itemBase, color: "var(--color-text-muted)" },
					}}
					onMouseEnter={(e) => {
						const el = e.currentTarget as HTMLElement;
						if (el.getAttribute("aria-current") !== "page") {
							el.style.background = "var(--color-surface-hover)";
							el.style.color = "var(--color-text)";
						}
					}}
					onMouseLeave={(e) => {
						const el = e.currentTarget as HTMLElement;
						if (el.getAttribute("aria-current") !== "page") {
							el.style.background = "transparent";
							el.style.color = "var(--color-text-muted)";
						}
					}}
				>
					<Icon size={16} strokeWidth={1.75} />
					<span>{label}</span>
				</Link>
			))}

			{/* Divider */}
			<div
				style={{
					borderTop: "1px solid var(--color-border)",
					margin: "10px 4px",
				}}
			/>

			{/* Quick actions */}
			<QuickAction
				label="New Trade"
				icon={Plus}
				color="var(--color-accent)"
				onClick={() => openDrawer("new-trade")}
			/>
			<QuickAction
				label="New Setup"
				icon={Zap}
				color="var(--color-amber)"
				onClick={() => openDrawer("new-setup")}
			/>
		</nav>
	);
}
