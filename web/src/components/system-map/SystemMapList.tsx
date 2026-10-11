import { t } from "@lingui/core/macro";
import { cn } from "@/lib/cn";
import type { DecisionId, Rule, SystemPart } from "@/lib/api/system";
import { MAP_NODES, type MapNodeId, nodeClarity, nodeSummaryLine } from "@/lib/system-map";
import { checkLabel, checkTone, type NodeCheck } from "@/lib/system-plan";
import {
  CheckIcon,
  clarityLabel,
  clarityTone,
  NodeProgress,
  NodeIcon,
  StatusIcon,
  systemNodeTitle,
} from "./SystemNode";

export function SystemMapList({
  rules,
  openQuestions,
  selected,
  onSelect,
  checks,
}: {
  rules: Partial<Record<DecisionId, Rule>> | undefined;
  openQuestions: Partial<Record<SystemPart, string>> | undefined;
  selected: MapNodeId | null;
  onSelect: (id: MapNodeId) => void;
  checks?: Record<MapNodeId, NodeCheck>;
}) {
  return (
    <ul className="flex flex-col gap-1.5" role="listbox" aria-label={t`System map`}>
      {MAP_NODES.map((n) => {
        const clarity = nodeClarity(n.id, rules, openQuestions);
        const active = selected === n.id;
        const line = nodeSummaryLine(n.id, rules);
        const filled = n.decisions.filter((d) => (rules?.[d]?.text ?? "").trim()).length;
        const check = checks?.[n.id];
        return (
          <li key={n.id}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(n.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl bg-card px-3 py-2.5 text-start shadow-sm",
                "transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
                "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active && "ring-2 ring-primary",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <NodeIcon id={n.id} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{systemNodeTitle(n.id)}</span>
                  {check ? (
                    <span className="text-2xs font-medium tabular-nums text-muted-foreground">
                      {check.answered}/{check.total}
                    </span>
                  ) : (
                    <NodeProgress filled={filled} total={n.decisions.length} />
                  )}
                </span>
                {check ? (
                  <span
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-2xs font-medium",
                      checkTone(check.state).text,
                    )}
                  >
                    <CheckIcon state={check.state} />
                    {checkLabel(check.state)}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-2xs font-medium",
                      clarityTone(clarity).text,
                    )}
                  >
                    <StatusIcon clarity={clarity} />
                    {clarityLabel(clarity)}
                  </span>
                )}
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
      <li className="px-3 pt-1 text-2xs leading-snug text-muted-foreground">
        {t`When entry conditions aren't met, you keep watching — that's a branch, not a failure.`}
      </li>
    </ul>
  );
}
