import { t } from "@lingui/core/macro";
import { AlertTriangle } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { Switch } from "@/components/ui/switch";
import type { DecisionId, Rule, Stance, SystemPart, SystemVersion } from "@/lib/api/system";
import {
  decisionCopy,
  emptyRule,
  partOf,
  STANCES,
  stanceHint,
  stanceLabel,
  vagueWords,
} from "@/lib/system";
import { starterPrompt } from "@/lib/system-map";

export function RuleEditor({
  decisions,
  rules,
  openQuestions,
  regimes,
  tradeTypes,
  readonly,
  version,
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
  version?: Pick<SystemVersion, "regimes"> | null;
  onRuleChange: (id: DecisionId, patch: Partial<Rule>) => void;
  onOpenQuestion: (part: SystemPart, text: string) => void;
  onRegimeLabel: (stance: Stance, label: string) => void;
  onTradeTypeLabel: (key: string, label: string) => void;
}) {
  const parts = [...new Set(decisions.map(partOf))];

  return (
    <div className="flex flex-col gap-6">
      {decisions.map((id) => {
        const copy = decisionCopy(id);
        const rule = rules[id] ?? emptyRule();
        const vague = vagueWords(rule.text);
        const starter = starterPrompt(id);
        return (
          <div key={id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">
                  {copy.title}
                  {starter ? (
                    <span className="ms-2 text-2xs font-normal text-primary">{t`Start here`}</span>
                  ) : null}
                </h3>
                <p className="text-2xs text-muted-foreground">{copy.question}</p>
              </div>
              <label className="flex items-center gap-2 text-2xs text-muted-foreground">
                <span>{t`Someone else would decide the same`}</span>
                <Switch
                  checked={rule.executable}
                  disabled={readonly}
                  onCheckedChange={(v) => onRuleChange(id, { executable: v })}
                />
              </label>
            </div>
            <FormTextarea
              value={rule.text}
              disabled={readonly}
              rows={4}
              placeholder={copy.example}
              onChange={(e) => onRuleChange(id, { text: e.target.value })}
            />
            {vague.length > 0 ? (
              <p className="flex items-start gap-1.5 text-2xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t`Vague wording — make it objective:`} {vague.join(", ")}
              </p>
            ) : null}
            {id === "market" ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {STANCES.map((stance) => (
                  <label key={stance} className="flex flex-col gap-1 text-2xs">
                    <span className="text-muted-foreground">
                      {stanceLabel(stance, version)} — {stanceHint(stance)}
                    </span>
                    <FormInput
                      value={regimes[stance] ?? ""}
                      disabled={readonly}
                      onChange={(e) => onRegimeLabel(stance, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {id === "definition" ? (
              <div className="grid gap-2 sm:grid-cols-2">
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
          </div>
        );
      })}
      {parts.map((part) => (
        <label key={part} className="flex flex-col gap-1">
          <span className="text-2xs text-muted-foreground">
            {t`Open questions (${part}) — ambiguous, conflicting or missing cases`}
          </span>
          <FormTextarea
            value={openQuestions[part] ?? ""}
            disabled={readonly}
            rows={2}
            onChange={(e) => onOpenQuestion(part, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
