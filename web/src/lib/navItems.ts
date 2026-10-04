import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  House,
  List,
  PieChart,
  StickyNote,
  Upload,
  Zap,
} from "lucide-react";
import type { AppHotkeyId } from "./hotkeys";
import type { LucideIcon } from "lucide-react";
import type { navLabel } from "./locale";
import type { ModalKind } from "./ui";

export type NavItem = {
  to: string;
  labelKey: Parameters<typeof navLabel>[1];
  icon: LucideIcon;
  /** Further path prefixes this item owns — `/today` redirects onto `/day/<date>`. */
  match?: string[];
};

export type CreateAction = {
  modal: ModalKind;
  labelKey: Parameters<typeof navLabel>[1];
  icon: LucideIcon;
  /** Binding advertised beside the row in the quick-add menu. */
  hotkeyId: AppHotkeyId;
};

/**
 * Quick-add targets, shared by the desktop rail, the mobile nav drawer, and the
 * bottom bar's centre button — one list so the three can't drift apart.
 *
 * Icons name the *object* (a trade shares the Trades glyph); the label carries
 * the verb. A bare `Plus` here would only say "add something".
 */
export const CREATE_ACTIONS: CreateAction[] = [
  { modal: "new-trade", labelKey: "newTrade", icon: List, hotkeyId: "action-new-trade" },
  { modal: "new-setup", labelKey: "newSetup", icon: Zap, hotkeyId: "action-new-setup" },
  { modal: "new-note", labelKey: "newNote", icon: StickyNote, hotkeyId: "action-new-note" },
];

/** Shown in the desktop/tablet rail top group and the mobile bottom tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/home", labelKey: "home", icon: House },
  {
    to: "/today",
    labelKey: "today",
    icon: CalendarCheck,
    // Routines and Missed trades are Today's sections opened full-size.
    match: ["/day", "/routines", "/missed"],
  },
  { to: "/trades", labelKey: "trades", icon: List },
  { to: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/reports", labelKey: "reports", icon: PieChart },
];

/**
 * Shown in the desktop/tablet rail bottom group and the mobile nav drawer.
 *
 * Routines and Missed trades are sections of Today, not destinations of their
 * own; Events and the calculators live in the Tools menu. All of them keep
 * their routes and command-palette entries.
 */
export const SECONDARY_NAV: NavItem[] = [
  { to: "/notes", labelKey: "notes", icon: StickyNote },
  { to: "/playbook", labelKey: "playbook", icon: BookOpen },
  { to: "/import", labelKey: "import", icon: Upload },
];

export const MAIN_ROUTES: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/**
 * Primary routes that live in the phone "More" drawer instead of the bottom
 * capsule: two tabs either side of the centre create button keep it centred.
 */
export const DRAWER_PRIMARY = new Set(["/calendar", "/reports"]);

export function isRouteActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function isNavItemActive(pathname: string, item: NavItem) {
  return (
    isRouteActive(pathname, item.to) ||
    (item.match ?? []).some((prefix) => isRouteActive(pathname, prefix))
  );
}
