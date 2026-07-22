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

export interface ToolItem {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

export const TOOL_ITEMS: ToolItem[] = [
  {
    id: "size",
    label: "Position size",
    icon: Calculator,
    keywords: ["calculator", "risk", "shares", "qty"],
  },
  {
    id: "planner",
    label: "Trade planner",
    icon: LayoutGrid,
    keywords: ["plan", "setup"],
  },
  {
    id: "kelly",
    label: "Kelly criterion",
    icon: Scale,
    keywords: ["kelly", "sizing"],
  },
  {
    id: "fx",
    label: "Currency converter",
    icon: RefreshCw,
    keywords: ["forex", "fx", "currency"],
  },
  {
    id: "today",
    label: "Today",
    icon: CalendarDays,
    keywords: ["calendar", "now"],
  },
  {
    id: "chart",
    label: "Advanced chart",
    icon: ChartLine,
    keywords: ["chart", "technical"],
  },
  {
    id: "econ",
    label: "Economic calendar",
    icon: Globe,
    keywords: ["news", "events", "macro"],
  },
  {
    id: "rating",
    label: "Technical rating",
    icon: TrendingUp,
    keywords: ["rating", "signal"],
  },
  {
    id: "heatmap",
    label: "Heatmap",
    icon: Flame,
    keywords: ["sector", "market"],
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    keywords: ["cash", "balance", "account"],
  },
];
