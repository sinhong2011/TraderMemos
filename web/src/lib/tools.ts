import {
  Calculator,
  CalendarDays,
  ChartLine,
  Flame,
  Globe,
  LayoutGrid,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToolId =
  | "size"
  | "planner"
  | "kelly"
  | "fx"
  | "today"
  | "chart"
  | "econ"
  | "rating"
  | "heatmap"
  | "wallet";

export type ToolGroupId = "calculators" | "markets" | "journal";

export interface ToolItem {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  group: ToolGroupId;
}

/** Section order for the tools menu — headings turn ten icons into three short lists. */
export const TOOL_GROUPS: { id: ToolGroupId; label: string }[] = [
  { id: "calculators", label: "Calculators" },
  { id: "markets", label: "Markets" },
  { id: "journal", label: "Journal" },
];

export const TOOL_ITEMS: ToolItem[] = [
  {
    id: "size",
    label: "Position size",
    icon: Calculator,
    keywords: ["calculator", "risk", "shares", "qty"],
    group: "calculators",
  },
  {
    id: "planner",
    label: "Trade planner",
    icon: LayoutGrid,
    keywords: ["plan", "setup"],
    group: "calculators",
  },
  {
    id: "kelly",
    label: "Kelly criterion",
    icon: Scale,
    keywords: ["kelly", "sizing"],
    group: "calculators",
  },
  {
    id: "fx",
    label: "Currency converter",
    icon: RefreshCw,
    keywords: ["forex", "fx", "currency"],
    group: "calculators",
  },
  {
    id: "today",
    label: "Today",
    icon: CalendarDays,
    keywords: ["calendar", "now"],
    group: "journal",
  },
  {
    id: "chart",
    label: "Advanced chart",
    icon: ChartLine,
    keywords: ["chart", "technical"],
    group: "markets",
  },
  {
    id: "econ",
    label: "Economic calendar",
    icon: Globe,
    keywords: ["news", "events", "macro"],
    group: "markets",
  },
  {
    id: "rating",
    label: "Technical rating",
    icon: TrendingUp,
    keywords: ["rating", "signal"],
    group: "markets",
  },
  {
    id: "heatmap",
    label: "Heatmap",
    icon: Flame,
    keywords: ["sector", "market"],
    group: "markets",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    keywords: ["cash", "balance", "account"],
    group: "journal",
  },
];

export function toolsInGroup(group: ToolGroupId): ToolItem[] {
  return TOOL_ITEMS.filter((tool) => tool.group === group);
}
