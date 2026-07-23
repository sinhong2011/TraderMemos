import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  List,
  PieChart,
  StickyNote,
  Target,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { navLabel } from "./locale";

export type NavItem = {
  to: string;
  labelKey: Parameters<typeof navLabel>[1];
  icon: LucideIcon;
};

/** Shown in the desktop/tablet rail top group and the mobile bottom tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { to: "/trades", labelKey: "trades", icon: List },
  { to: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/reports", labelKey: "reports", icon: PieChart },
];

/** Shown in the desktop/tablet rail bottom group and the mobile nav drawer. */
export const SECONDARY_NAV: NavItem[] = [
  { to: "/notes", labelKey: "notes", icon: StickyNote },
  { to: "/playbook", labelKey: "playbook", icon: BookOpen },
  { to: "/calculator", labelKey: "calculator", icon: Target },
  { to: "/import", labelKey: "import", icon: Upload },
];

export const MAIN_ROUTES: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
