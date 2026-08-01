import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Calculator,
  House,
  List,
  PieChart,
  Plus,
  Settings,
  StickyNote,
  Upload,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { APP_HOTKEYS, type AppHotkeyId } from "./hotkeys";
import { TOOL_ITEMS } from "./tools";
import { useToolRunner } from "./useToolRunner";
import { useUI, type ModalKind } from "./ui";

export type CommandGroup = "Navigate" | "Actions" | "Tools";

export interface CommandItem {
  id: string;
  label: string;
  group: CommandGroup;
  icon: LucideIcon;
  keywords: string[];
  /** UI badge for the bound hotkey, when one exists. */
  shortcut?: string;
  run: () => void;
}

function shortcutFor(id: string): string | undefined {
  if (id in APP_HOTKEYS) {
    return APP_HOTKEYS[id as AppHotkeyId].label;
  }
  return undefined;
}

const NAV_COMMANDS: Array<{
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  keywords?: string[];
}> = [
  {
    id: "nav-home",
    label: "Home",
    to: "/home",
    icon: House,
  },
  { id: "nav-trades", label: "Trades", to: "/trades", icon: List },
  {
    id: "nav-calendar",
    label: "Calendar",
    to: "/calendar",
    icon: CalendarDays,
  },
  { id: "nav-stats", label: "Stats", to: "/reports", icon: PieChart },
  { id: "nav-playbook", label: "Playbook", to: "/playbook", icon: BookOpen },
  {
    id: "nav-notes",
    label: "Notes",
    to: "/notes",
    icon: StickyNote,
    keywords: ["journal", "memo"],
  },
  {
    id: "nav-calculator",
    label: "Calculator",
    to: "/calculator",
    icon: Calculator,
    keywords: ["r-multiple", "r", "exit ladder", "fvg", "position size"],
  },
  { id: "nav-import ", label: "Import", to: "/import", icon: Upload },
  {
    id: "nav-settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
  },
];

const ACTION_COMMANDS: Array<{
  id: string;
  label: string;
  modal: ModalKind;
  icon: LucideIcon;
  keywords?: string[];
}> = [
  {
    id: "action-new-trade",
    label: "New Trade",
    modal: "new-trade",
    icon: Plus,
    keywords: ["log", "create"],
  },
  {
    id: "action-new-setup",
    label: "New Setup",
    modal: "new-setup",
    icon: Zap,
    keywords: ["playbook"],
  },
  {
    id: "action-new-note",
    label: "New Note",
    modal: "new-note",
    icon: StickyNote,
    keywords: ["journal"],
  },
];

export function useCommands(onRun?: () => void) {
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const runTool = useToolRunner();

  return useMemo(() => {
    const wrap = (run: () => void) => () => {
      run();
      onRun?.();
    };

    const navigateCommands: CommandItem[] = NAV_COMMANDS.map((item) => ({
      id: item.id,
      label: item.label,
      group: "Navigate",
      icon: item.icon,
      keywords: item.keywords ?? [],
      shortcut: shortcutFor(item.id),
      run: wrap(() => navigate({ to: item.to })),
    }));

    const actionCommands: CommandItem[] = ACTION_COMMANDS.map((item) => ({
      id: item.id,
      label: item.label,
      group: "Actions",
      icon: item.icon,
      keywords: item.keywords ?? [],
      shortcut: shortcutFor(item.id),
      run: wrap(() => openModal(item.modal)),
    }));

    const toolCommands: CommandItem[] = TOOL_ITEMS.map((item) => {
      const id = `tool-${item.id}`;
      return {
        id,
        label: item.label,
        group: "Tools" as const,
        icon: item.icon,
        keywords: item.keywords,
        shortcut: shortcutFor(id),
        run: wrap(() => runTool(item.id)),
      };
    });

    return [...navigateCommands, ...actionCommands, ...toolCommands];
  }, [navigate, onRun, openModal, runTool]);
}
