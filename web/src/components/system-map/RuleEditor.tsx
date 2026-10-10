import { t } from "@lingui/core/macro";
import { AlertTriangle, Sparkles } from "lucide-react";
import { type ReactNode, useId } from "react";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { Switch } from "@/components/ui/switch";
import type { DecisionId, Rule, Stance, SystemPart } from "@/lib/api/system";
import {
  customRegimeLabel,
  decisionCopy,
  DECISIONS,
  emptyRule,
  partCopy,
  partOf,
  STANCES,
  stanceHint,
  stanceLabel,
  vagueWords,
} from "@/lib/system";
import { starterPrompt } from "@/lib/system-map";
import { InspectorSection } from "./InspectorFrame";

function decisionIndex(id: DecisionId): number {
  const i = DECISIONS.indexOf(id);
  return i >= 0 ? i + 1 : 0;
}

function DecisionBlock({
  id,
  rule,
  readonly,
  onRuleChange,
  children,
}: {
  id: DecisionId;
  rule: Rule;
  readonly: boolean;
  onRuleChange: (id: DecisionId, patch: Partial<Rule>) => void;
  children?: ReactNode;
}) {
  const copy = decisionCopy(id);
  const vague = vagueWords(rule.text);
  const fieldId = useId();
  const switchId = useId();
  return (
    <InspectorSection
      title={t`Decision ${decisionIndex(id)} · ${copy.title}`}
      action={
        starterPrompt(id) && !readonly && !rule.text.trim() ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
            <Sparkles className="size-3" aria-hidden />
            {t`Start here`}
          </span>
        ) : null
      }
    >
      <label htmlFor={fieldId} className="text-sm leading-snug text-foreground">
        {copy.question}
      </label>
      <FormTextarea
        id={fieldId}
        value={rule.text}
        disabled={readonly}
        rows={4}
        placeholder={readonly ? t`Not written in this version.` : copy.example}
        onChange={(e) => onRuleChange(id, { text: e.target.value })}
      />
      {vague.length > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-2xs leading-snug text-warning-foreground"
        >
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            {t`Vague wording — make it objective:`}{" "}
            <span className="font-semibold">{vague.join(", ")}</span>
          </span>
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
        <label htmlFor={switchId} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {t`Someone else would decide the same`}
          </span>
          <span className="text-2xs leading-snug text-muted-foreground">
            {t`Turn on once the rule leaves no room for judgment.`}
          </span>
        </label>
        <Switch
          id={switchId}
          className="mt-0.5"
          checked={rule.executable}
          disabled={readonly}
          onCheckedChange={(v) => onRuleChange(id, { executable: v })}
        />
      </div>
      {children}
    </InspectorSection>
  );
}

export function RuleEditor({
  decisions,
  rules,
  openQuestions,
  regimes,
  tradeTypes,
  readonly,
  onRuleChange,
  onOpenQuestion,
  onRegimeLabel,
  onTradeTypeLabel,
}: {
  decisions: DecisionId[];
  rules: Record<string, Rule>;
  openQuestions: Record<string, string>;
  regimes: Record<string, string>;
  tradeTypes: Record<string, string>;
  readonly: boolean;
  onRuleChange: (id: DecisionId, patch: Partial<Rule>) => void;
  onOpenQuestion: (part: SystemPart, text: string) => void;
  onRegimeLabel: (stance: Stance, label: string) => void;
  onTradeTypeLabel: (key: string, label: string) => void;
}) {
  const parts = [...new Set(decisions.map(partOf))];

  return (
    <div className="flex flex-col gap-7">
      {decisions.map((id) => (
        <DecisionBlock
          key={id}
          id={id}
          rule={rules[id] ?? emptyRule()}
          readonly={readonly}
          onRuleChange={onRuleChange}
        >
          {id === "market" ? (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-2xs text-muted-foreground">
                {t`Name the three stances your rule switches between.`}
              </p>
              <div className="grid items-stretch gap-2 sm:grid-cols-3">
                {STANCES.map((stance) => {
                  const label = stanceLabel(stance);
                  const custom = customRegimeLabel(stance, regimes);
                  return (
                    <label
                      key={stance}
                      className="flex h-full flex-col gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2 text-2xs"
                    >
                      <span className="font-semibold text-foreground">{label}</span>
                      <span className="min-h-10 leading-snug text-muted-foreground">
                        {stanceHint(stance)}
                      </span>
                      <FormInput
                        className="mt-auto"
                        value={custom}
                        placeholder={label}
                        aria-label={t`Name for ${label}`}
                        disabled={readonly}
                        onChange={(e) => onRegimeLabel(stance, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          {id === "definition" && Object.keys(tradeTypes).length > 0 ? (
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              {Object.keys(tradeTypes).map((key) => (
                <label key={key} className="flex flex-col gap-1 text-2xs">
                  <span className="text-muted-foreground">{t`Trade type: ${key}`}</span>
                  <FormInput
                    value={tradeTypes[key] ?? ""}
                    disabled={readonly}
                    onChange={(e) => onTradeTypeLabel(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </DecisionBlock>
      ))}
      {parts.map((part) => {
        const partTitle = partCopy(part).title;
        return (
          <InspectorSection key={part} title={t`Open questions · ${partTitle}`}>
            <p className="text-2xs leading-snug text-muted-foreground">
              {t`Cases your rules don't settle yet — ambiguous, conflicting or missing.`}
            </p>
            <FormTextarea
              value={openQuestions[part] ?? ""}
              disabled={readonly}
              rows={2}
              placeholder={
                readonly
                  ? t`None recorded.`
                  : t`e.g. What if the index gaps through the 200-day line?`
              }
              aria-label={t`Open questions · ${partTitle}`}
              onChange={(e) => onOpenQuestion(part, e.target.value)}
            />
          </InspectorSection>
        );
      })}
    </div>
  );
}
