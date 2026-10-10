import { t } from "@lingui/core/macro";
import { cn } from "@/lib/cn";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { MAP_NODES, type MapNodeId, nodeClarity } from "@/lib/system-map";
import { clarityLabel, systemNodeTitle } from "./SystemNode";

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
    <ul className="flex flex-col gap-1" role="listbox" aria-label={t`System map`}>
      {MAP_NODES.map((n) => {
        const clarity = nodeClarity(n.id, rules, openQuestions);
        const active = selected === n.id;
        return (
          <li key={n.id}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(n.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
                "hover:bg-accent",
                active && "bg-accent ring-2 ring-primary",
                clarity === "needs_clarity" && !active && "bg-amber-500/10",
              )}
            >
              <span className="text-sm font-medium">{systemNodeTitle(n.id)}</span>
              <span className="text-2xs text-muted-foreground">{clarityLabel(clarity)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
