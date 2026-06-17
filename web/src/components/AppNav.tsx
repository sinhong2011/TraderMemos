import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  List,
  BookOpen,
  BarChart3,
  Settings,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Routes that exist in the router (type-safe Links)
const ROUTER_ROUTES = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

// Routes planned for future phases (render as plain anchors until added to router)
const FUTURE_ROUTES: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/calendar",  label: "Calendar",  icon: CalendarDays },
  { href: "/trades",    label: "Trades",    icon: List },
  { href: "/playbook",  label: "Playbook",  icon: BookOpen },
  { href: "/reports",   label: "Reports",   icon: BarChart3 },
  { href: "/accounts",  label: "Accounts",  icon: Settings },
  { href: "/import",    label: "Import",    icon: Upload },
];

const itemBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "7px 10px",
  borderRadius: "var(--radius-control)",
  fontSize: "13px",
  textDecoration: "none",
  transition: `background var(--duration-fast), color var(--duration-fast)`,
  cursor: "pointer",
};

function NavLink({
  label,
  icon: Icon,
  isActive,
  href,
}: {
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      style={{
        ...itemBase,
        color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
        background: isActive ? "var(--color-accent-subtle)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--color-surface-hover)";
          (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color =
            "var(--color-text-muted)";
        }
      }}
    >
      <Icon size={15} strokeWidth={1.5} />
      <span>{label}</span>
    </a>
  );
}

export function AppNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: "200px",
        minHeight: "100vh",
        background: "var(--color-surface-panel)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        padding: "0 8px 8px",
        flexShrink: 0,
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          padding: "12px 10px 12px",
          marginBottom: "4px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-accent)",
          }}
        >
          TraderMemos
        </span>
      </div>

      {/* Type-safe router links */}
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
            },
          }}
          inactiveProps={{
            style: {
              ...itemBase,
              color: "var(--color-text-muted)",
            },
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            const active = el.getAttribute("aria-current") === "page";
            if (!active) {
              el.style.background = "var(--color-surface-hover)";
              el.style.color = "var(--color-text)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            const active = el.getAttribute("aria-current") === "page";
            if (!active) {
              el.style.background = "transparent";
              el.style.color = "var(--color-text-muted)";
            }
          }}
        >
          <Icon size={15} strokeWidth={1.5} />
          <span>{label}</span>
        </Link>
      ))}

      {/* Future routes - plain anchors until added to router */}
      {FUTURE_ROUTES.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          icon={icon}
          isActive={currentPath === href}
        />
      ))}
    </nav>
  );
}
