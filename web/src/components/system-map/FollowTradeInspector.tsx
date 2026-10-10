import { t } from "@lingui/core/macro";
import { AlertTriangle, CheckSquare2, Circle, FileText, Info, Pencil, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisionId, Rule, SystemVersion } from "@/lib/api/system";
import { decisionCopy, DECISIONS, emptyRule } from "@/lib/system";
import type { MapNodeId } from "@/lib/system-map";
import { decisionsForNode } from "@/lib/system-map";
import { systemNodeTitle } from "./SystemNode";
import { InspectorFrame, InspectorSection } from "./InspectorFrame";

function decisionIndex(id: DecisionId): number {
  const i = DECISIONS.indexOf(id);
  return i >= 0 ? i + 1 : 0;
}

export function FollowTradeInspector({
  node,
  version,
  onEditDraft,
}: {
  node: MapNodeId;
  version: SystemVersion | null;
  onEditDraft: () => void;
}) {
  const decisions = decisionsForNode(node);
  const primary = decisions[0];
  const rule: Rule = (primary && version?.rules?.[primary]) || emptyRule();
  const copy = primary ? decisionCopy(primary) : null;
  const hasRule = Boolean(rule.text.trim());
  const label = version?.label ?? "—";

  return (
    <InspectorFrame
      title={systemNodeTitle(node)}
      subtitle={
        primary && copy
          ? t`Decision ${decisionIndex(primary)} · ${copy.title}`
          : t`Select a node on the map`
      }
      footer={
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              disabled
              title={t`Available when a trade is attached (Phase C–E)`}
            >
              <FileText className="size-4" />
              {t`Record evidence`}
            </Button>
            <Button type="button" variant="outline" onClick={onEditDraft}>
              <Pencil className="size-4" />
              {t`Edit draft`}
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t`This mode organizes recorded conditions and evidence — it does not place orders.`}
          </p>
        </>
      }
    >
      <InspectorSection
        title={t`Rule`}
        action={<span className="text-2xs text-muted-foreground">{label}</span>}
      >
        {hasRule ? (
          <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
            {rule.text}
          </p>
        ) : (
          <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            {t`No rule written for this decision yet. Edit the draft to add one.`}
          </p>
        )}
      </InspectorSection>

      <InspectorSection title={t`Condition check`}>
        <ul className="flex flex-col gap-1.5">
          {(hasRule
            ? rule.text
                .split(/[;\n]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 4)
            : [t`Attach a trade to check conditions against this rule`]
          ).map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 24)}`}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
            >
              {hasRule ? (
                <Square className="mt-0.5 size-4 shrink-0 opacity-50" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 opacity-40" aria-hidden />
              )}
              <span className="leading-snug">{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 flex items-center gap-1.5 text-2xs text-muted-foreground">
          <CheckSquare2 className="size-3.5" />
          {t`Checks unlock when Follow trade has a linked opportunity (Phase C).`}
        </p>
      </InspectorSection>

      <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning-foreground ring-1 ring-warning/25">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <div className="font-medium">{t`Waiting for a trade`}</div>
          <p className="mt-0.5 text-2xs opacity-90">
            {t`No live opportunity is attached yet — the map still shows where this decision sits.`}
          </p>
        </div>
      </div>

      <InspectorSection title={t`Evidence at the time`}>
        <ol className="relative ms-2 flex flex-col gap-3 border-s border-border/60 ps-4">
          <li className="relative text-sm text-muted-foreground">
            <span className="absolute -start-[1.3rem] top-1.5 size-2 rounded-full bg-muted-foreground/40" />
            {t`No evidence recorded yet.`}
          </li>
        </ol>
        <button
          type="button"
          disabled
          className="mt-1 text-start text-2xs text-primary/70 disabled:opacity-60"
        >
          {t`View plan snapshot`}
        </button>
      </InspectorSection>
    </InspectorFrame>
  );
}
