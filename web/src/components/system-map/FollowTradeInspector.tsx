import { t } from "@lingui/core/macro";
import { Info, Pencil, Plus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisionId, SystemVersion } from "@/lib/api/system";
import { decisionCopy, DECISIONS } from "@/lib/system";
import type { MapNodeId } from "@/lib/system-map";
import { decisionsForNode, nodeClarity } from "@/lib/system-map";
import { ClarityPill, NodeIcon, NodeProgress, systemNodeTitle } from "./SystemNode";
import { InspectorFrame, InspectorSection } from "./InspectorFrame";

function decisionIndex(id: DecisionId): number {
  const i = DECISIONS.indexOf(id);
  return i >= 0 ? i + 1 : 0;
}

function conditionLines(text: string): string[] {
  return text
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FollowTradeInspector({
  node,
  version,
  onEditDraft,
  onNewPlan,
}: {
  node: MapNodeId;
  version: SystemVersion | null;
  onEditDraft: () => void;
  /** Absent when no version is active, so there is nothing to plan against. */
  onNewPlan?: () => void;
}) {
  const decisions = decisionsForNode(node);
  const written = decisions.filter((d) => version?.rules?.[d]?.text.trim());
  const conditions = written.flatMap((d) => conditionLines(version!.rules[d]!.text)).slice(0, 6);
  const label = version?.label ?? "—";

  return (
    <InspectorFrame
      title={systemNodeTitle(node)}
      subtitle={t`Following ${label}`}
      icon={<NodeIcon id={node} className="size-4.5" />}
      meta={
        <>
          <ClarityPill clarity={nodeClarity(node, version?.rules, version?.open_questions)} />
          <NodeProgress filled={written.length} total={decisions.length} />
        </>
      }
      footer={
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onEditDraft}>
              <Pencil className="size-4" aria-hidden />
              {t`Edit rules`}
            </Button>
            <Button
              type="button"
              disabled={!onNewPlan}
              title={onNewPlan ? undefined : t`Activate a version before planning trades`}
              onClick={onNewPlan}
            >
              <Plus className="size-4" aria-hidden />
              {t`New plan`}
            </Button>
          </div>
          <p className="text-2xs leading-snug text-muted-foreground">
            {t`Follow mode organizes conditions and evidence. It never places orders.`}
          </p>
        </>
      }
    >
      <div className="flex items-start gap-2.5 rounded-lg bg-info/10 px-3 py-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-info-foreground" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{t`No plan open`}</div>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
            {onNewPlan
              ? t`Write a plan before the fill: setup, trigger, prices, and an answer for each rule. Link the trade once it fills.`
              : t`Activate a version first — plans are checked against the rules in use.`}
          </p>
        </div>
      </div>

      <InspectorSection title={decisions.length > 1 ? t`Your rules` : t`Your rule`}>
        <ul className="flex flex-col gap-2">
          {decisions.map((d) => {
            const text = version?.rules?.[d]?.text.trim() ?? "";
            return (
              <li key={d} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="text-2xs font-medium text-muted-foreground">
                  {t`Decision ${decisionIndex(d)} · ${decisionCopy(d).title}`}
                </div>
                <p
                  className={
                    text
                      ? "mt-1 text-sm leading-relaxed text-foreground"
                      : "mt-1 text-sm text-muted-foreground/80"
                  }
                >
                  {text || t`Not written yet.`}
                </p>
              </li>
            );
          })}
        </ul>
      </InspectorSection>

      <InspectorSection title={t`Condition check`}>
        {conditions.length > 0 ? (
          <ul className="flex flex-col gap-0.5" aria-label={t`Conditions to confirm`}>
            {conditions.map((line, i) => (
              <li
                key={`${i}-${line.slice(0, 24)}`}
                className="flex items-start gap-2.5 rounded-md px-1 py-1.5 text-sm text-muted-foreground"
              >
                <Square className="mt-0.5 size-4 shrink-0 opacity-50" aria-hidden />
                <span className="leading-snug">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t`Write a rule to turn it into conditions you can tick off.`}
          </p>
        )}
      </InspectorSection>

      <InspectorSection title={t`Evidence at the time`}>
        <p className="text-sm text-muted-foreground">
          {t`Nothing recorded yet. Screenshots and notes captured while following a trade land here.`}
        </p>
      </InspectorSection>
    </InspectorFrame>
  );
}
