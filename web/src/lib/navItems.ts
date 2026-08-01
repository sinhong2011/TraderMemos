import {
  BookOpen,
  CalendarDays,
  Calculator,
  House,
  List,
  PieChart,
  StickyNote,
  Upload,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { navLabel } from "./locale";
import type { ModalKind } from "./ui";

export type NavItem = {
  to: string;
  labelKey: Parameters<typeof navLabel>[1];
  icon: LucideIcon;
};

export type CreateAction = {
  modal: ModalKind;
  labelKey: Parameters<typeof navLabel>[1];
  icon: LucideIcon;
};

/**
 * Quick-add targets, shared by the desktop rail, the mobile nav drawer, and the
 * bottom bar's centre button — one list so the three can't drift apart.
 *
 * Icons name the *object* (a trade shares the Trades glyph); the label carries
 * the verb. A bare `Plus` here would only say "add something".
 */
export const CREATE_ACTIONS: CreateAction[] = [
  { modal: "new-trade", labelKey: "newTrade", icon: List },
  { modal: "new-setup", labelKey: "newSetup", icon: Zap },
  { modal: "new-note", labelKey: "newNote", icon: StickyNote },
];

/** Shown in the desktop/tablet rail top group and the mobile bottom tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/home", labelKey: "home", icon: House },
  { to: "/trades", labelKey: "trades", icon: List },
  { to: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/reports", labelKey: "reports", icon: PieChart },
];

/** Shown in the desktop/tablet rail bottom group and the mobile nav drawer. */
export const SECONDARY_NAV: NavItem[] = [
  { to: "/notes", labelKey: "notes", icon: StickyNote },
  { to: "/playbook", labelKey: "playbook", icon: BookOpen },
  { to: "/calculator", labelKey: "calculator", icon: Calculator },
  { to: "/import", labelKey: "import", icon: Upload },
];

export const MAIN_ROUTES: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
