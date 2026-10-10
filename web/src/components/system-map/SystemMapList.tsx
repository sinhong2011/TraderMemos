import { t } from "@lingui/core/macro";
import {
  BarChart3,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock3,
  Crosshair,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { MAP_NODES, type MapNodeId, nodeClarity, nodeSummaryLine } from "@/lib/system-map";
import { clarityLabel, systemNodeTitle } from "./SystemNode";

function nodeIcon(id: MapNodeId): LucideIcon {
  switch (id) {
    case "market":
      return BarChart3;
    case "entry":
      return Crosshair;
    case "risk":
      return Gauge;
    case "holding":
      return ClipboardList;
    case "review":
      return BarChart3;
  }
}

function StatusIcon({ clarity }: { clarity: ReturnType<typeof nodeClarity> }) {
  if (clarity === "self_clear") return <CheckCircle2 className="size-3.5 text-success" />;
  if (clarity === "needs_clarity") return <Clock3 className="size-3.5 text-primary" />;
  return <CircleDashed className="size-3.5 text-muted-foreground" />;
}

export function SystemMapList({
  rules,
  openQuestions,
  selected,
  onSelect,
}: {
  rules: Partial<Record<DecisionId, Rule>> | undefined;
  openQuestions: Partial<Record<SystemPart, string>> | undefined;
  selected: MapNodeId | null;
  onSelect: (id: MapNodeId) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5" role="listbox" aria-label={t`System map`}>
      {MAP_NODES.map((n) => {
        const clarity = nodeClarity(n.id, rules, openQuestions);
        const active = selected === n.id;
        const Icon = nodeIcon(n.id);
        const line = nodeSummaryLine(n.id, rules);
        return (
          <li key={n.id}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(n.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                "hover:bg-accent",
                active && "bg-accent ring-2 ring-primary",
                clarity === "needs_clarity" && !active && "ring-1 ring-primary/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{systemNodeTitle(n.id)}</span>
                <span className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <StatusIcon clarity={clarity} />
                  {clarityLabel(clarity)}
                </span>
                {line ? (
                  <span className="mt-1 line-clamp-2 block text-2xs text-muted-foreground">
                    {line}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
      <li className="px-3 pt-1 text-2xs text-muted-foreground">
        {t`Conditions not met → keep watching is a branch of Entry, not a failure.`}
      </li>
    </ul>
  );
}
