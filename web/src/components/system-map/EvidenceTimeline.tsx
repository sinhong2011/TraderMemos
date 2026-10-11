import { t } from "@lingui/core/macro";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { DateTimePicker } from "@/components/DateTimePicker";
import { Field } from "@/components/Field";
import { FormTextarea } from "@/components/FormInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type {
  DecisionId,
  EvidenceAction,
  EvidenceBody,
  EvidenceEntry,
  EvidenceRevision,
  EvidenceStance,
  EvidenceState,
  PlanSource,
} from "@/lib/api/system";
import { isoToWallClock, wallClockToIso } from "@/lib/displayPrefs";
import { fmtDateTime } from "@/lib/format";
import {
  useAddEvidenceRevision,
  useCreatePlanEvidence,
  usePlanEvidence,
  useWithdrawPlanEvidence,
} from "@/lib/hooks/useSystem";
import { decisionCopy, DECISIONS } from "@/lib/system";
import { ReasonDialog } from "./PlanDialogs";
import { InspectorSection } from "./InspectorFrame";

const failMessage = (err: unknown) => (err instanceof Error ? err.message : t`Request failed`);

function stanceLabel(s: EvidenceStance): string {
  switch (s) {
    case "support":
      return t`Supports`;
    case "weaken":
      return t`Weakens`;
    default:
      return t`Uncertain`;
  }
}

function stateLabel(s: EvidenceState): string {
  switch (s) {
    case "wrong":
      return t`Wrong`;
    case "not_working":
      return t`Not working`;
    case "finished":
      return t`Finished`;
    default:
      return t`Still working`;
  }
}

function actionLabel(a: EvidenceAction): string {
  switch (a) {
    case "add":
      return t`Add`;
    case "trim":
      return t`Trim`;
    case "take_profit":
      return t`Take profit`;
    case "exit":
      return t`Exit`;
    default:
      return t`Hold`;
  }
}

interface Draft {
  decisionId: DecisionId;
  stance: EvidenceStance;
  body: string;
  state: EvidenceState;
  action: EvidenceAction;
  source: PlanSource;
  occurredAt: string;
}

function blankDraft(): Draft {
  return {
    decisionId: "evidence",
    stance: "support",
    body: "",
    state: "still_working",
    action: "hold",
    source: "live",
    occurredAt: isoToWallClock(new Date().toISOString()),
  };
}

function draftFromRevision(r: EvidenceRevision): Draft {
  return {
    decisionId: r.decision_id,
    stance: r.stance,
    body: r.body,
    state: r.state,
    action: r.action,
    source: r.source,
    occurredAt: isoToWallClock(r.occurred_at ?? r.recorded_at),
  };
}

function toBody(draft: Draft): EvidenceBody {
  return {
    decision_id: draft.decisionId,
    stance: draft.stance,
    body: draft.body.trim(),
    state: draft.state,
    action: draft.action,
    source: draft.source,
    occurred_at: draft.source === "retrospective" ? wallClockToIso(draft.occurredAt) : null,
  };
}

export function EvidenceTimeline({ planId, taken }: { planId: string; taken: boolean }) {
  const evidenceQ = usePlanEvidence(planId);
  const create = useCreatePlanEvidence(planId);
  const revise = useAddEvidenceRevision(planId);
  const withdraw = useWithdrawPlanEvidence(planId);
  const toast = useToastManager();
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const bodyId = useId();
  const whenId = useId();
  const pending = create.isPending || revise.isPending || withdraw.isPending;
  const data = evidenceQ.data;
  const scaling = draft.action === "add" || draft.action === "trim";

  const save = () => {
    if (!draft.body.trim() || pending) return;
    const body = toBody(draft);
    const done = {
      onSuccess: () => {
        setDraft(blankDraft());
        setCorrectingId(null);
        toast.add({
          title: correctingId ? t`Correction saved` : t`Evidence recorded`,
        });
      },
      onError: (e: unknown) =>
        toast.add({ title: t`Could not record evidence`, description: failMessage(e) }),
    };
    if (correctingId) revise.mutate({ evidenceId: correctingId, body }, done);
    else create.mutate(body, done);
  };

  return (
    <InspectorSection title={t`Evidence at the time`}>
      {!taken ? (
        <p className="text-sm text-muted-foreground">
          {t`Link a trade to record what you saw while holding. A note is your judgment — it is not an order.`}
        </p>
      ) : evidenceQ.isLoading ? (
        <Skeleton className="h-24" />
      ) : evidenceQ.isError || !data ? (
        <p className="text-sm text-muted-foreground">{t`Could not load evidence.`}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.prompt ? (
            <div className="flex items-start gap-2.5 rounded-lg bg-warning/10 px-3 py-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
              <p className="text-sm leading-snug text-foreground">
                {data.prompt.kind === "time_stop"
                  ? t`The time stop was due ${fmtDateTime(data.prompt.due_at)}. Record what you saw. This does not close the trade or judge the plan.`
                  : t`The planned hold ended ${fmtDateTime(data.prompt.due_at)}. Record what you saw. This does not close the trade or judge the plan.`}
              </p>
            </div>
          ) : null}

          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t`Nothing recorded while holding.`}</p>
          ) : (
            <ol className="flex flex-col gap-2" aria-label={t`Evidence while holding`}>
              {data.entries.map((entry) => (
                <EvidenceRow
                  key={entry.id}
                  entry={entry}
                  pending={pending}
                  onCorrect={() => {
                    if (!entry.latest) return;
                    setCorrectingId(entry.id);
                    setDraft(draftFromRevision(entry.latest));
                  }}
                  onWithdraw={() => setWithdrawId(entry.id)}
                />
              ))}
            </ol>
          )}

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {correctingId ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {t`Correcting this note. The earlier wording stays.`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCorrectingId(null);
                    setDraft(blankDraft());
                  }}
                >
                  {t`Cancel`}
                </Button>
              </div>
            ) : null}

            <Field label={t`Decision`}>
              <NativeSelect
                aria-label={t`Decision`}
                wrapperClassName="w-full"
                className="w-full"
                value={draft.decisionId}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, decisionId: e.target.value as DecisionId }))
                }
              >
                {DECISIONS.map((id) => (
                  <NativeSelectOption key={id} value={id}>
                    {decisionCopy(id).title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field label={t`What it does to the rule`}>
              <SegmentedControl
                ariaLabel={t`What it does to the rule`}
                fullWidth
                size="sm"
                value={draft.stance}
                onChange={(v) => setDraft((d) => ({ ...d, stance: v as EvidenceStance }))}
                options={[
                  { value: "support", label: t`Supports` },
                  { value: "weaken", label: t`Weakens` },
                  { value: "uncertain", label: t`Uncertain` },
                ]}
              />
            </Field>

            <Field label={t`Evidence note`} htmlFor={bodyId}>
              <FormTextarea
                id={bodyId}
                value={draft.body}
                rows={3}
                maxLength={2000}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t`State`}>
                <NativeSelect
                  aria-label={t`State`}
                  wrapperClassName="w-full"
                  className="w-full"
                  value={draft.state}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, state: e.target.value as EvidenceState }))
                  }
                >
                  {(["still_working", "not_working", "wrong", "finished"] as const).map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {stateLabel(s)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t`Action`}>
                <NativeSelect
                  aria-label={t`Action`}
                  wrapperClassName="w-full"
                  className="w-full"
                  value={draft.action}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, action: e.target.value as EvidenceAction }))
                  }
                >
                  {(["hold", "add", "trim", "take_profit", "exit"] as const).map((a) => (
                    <NativeSelectOption key={a} value={a}>
                      {actionLabel(a)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            {scaling ? (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="text-sm leading-snug text-foreground">
                  {t`Adding or trimming is a note. It is not an order, and it is not marked as breaking a rule.`}
                </p>
                <p className="mt-1 text-2xs leading-snug text-muted-foreground">
                  {data.scaling_rule.trim()
                    ? data.scaling_rule
                    : t`This version has no scaling rule written.`}
                </p>
              </div>
            ) : null}

            <Field
              label={t`When`}
              description={
                draft.source === "live"
                  ? t`Recorded now, while you were in the trade.`
                  : t`Marked as written after the fact. The earlier note stays.`
              }
            >
              <SegmentedControl
                ariaLabel={t`When`}
                fullWidth
                size="sm"
                value={draft.source}
                onChange={(v) => setDraft((d) => ({ ...d, source: v as PlanSource }))}
                options={[
                  { value: "live", label: t`At the time` },
                  { value: "retrospective", label: t`After the fact` },
                ]}
              />
            </Field>
            {draft.source === "retrospective" ? (
              <Field label={t`When it happened`} htmlFor={whenId}>
                <DateTimePicker
                  id={whenId}
                  value={draft.occurredAt}
                  onChange={(occurredAt) => setDraft((d) => ({ ...d, occurredAt }))}
                />
              </Field>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs leading-snug text-muted-foreground">
                {t`Recording an action does not place an order.`}
              </p>
              <Button type="submit" size="sm" disabled={pending || !draft.body.trim()}>
                {correctingId ? t`Save correction` : t`Record`}
              </Button>
            </div>
          </form>
        </div>
      )}

      <ReasonDialog
        open={withdrawId != null}
        onOpenChange={(v) => !v && setWithdrawId(null)}
        title={t`Withdraw this note`}
        description={t`The wording stays on the timeline. Say why you are withdrawing it.`}
        confirmLabel={t`Withdraw`}
        destructive
        pending={withdraw.isPending}
        onConfirm={(reason) => {
          if (!withdrawId) return;
          withdraw.mutate(
            { evidenceId: withdrawId, reason },
            {
              onSuccess: () => {
                setWithdrawId(null);
                if (correctingId === withdrawId) {
                  setCorrectingId(null);
                  setDraft(blankDraft());
                }
                toast.add({ title: t`Note withdrawn` });
              },
              onError: (e) =>
                toast.add({ title: t`Could not withdraw`, description: failMessage(e) }),
            },
          );
        }}
      />
    </InspectorSection>
  );
}

function EvidenceRow({
  entry,
  pending,
  onCorrect,
  onWithdraw,
}: {
  entry: EvidenceEntry;
  pending: boolean;
  onCorrect: () => void;
  onWithdraw: () => void;
}) {
  const latest = entry.latest;
  if (!latest) return null;
  const earlier = entry.revisions.slice(0, -1);
  const withdrawn = entry.withdrawn_at != null;
  return (
    <li className="flex flex-col gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {decisionCopy(latest.decision_id).title}
        </span>
        <span className="shrink-0 text-2xs text-muted-foreground">
          {t`Recorded ${fmtDateTime(latest.recorded_at)}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
        <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
          {stanceLabel(latest.stance)}
        </span>
        <span>{stateLabel(latest.state)}</span>
        <span aria-hidden>·</span>
        <span>{actionLabel(latest.action)}</span>
        {latest.source === "retrospective" ? (
          <span className="rounded-full bg-info/10 px-2 py-0.5 font-medium text-info-foreground">
            {t`After the fact`}
          </span>
        ) : null}
        {latest.seq > 1 ? <span>{t`Revision ${latest.seq}`}</span> : null}
      </div>
      <p className="text-sm leading-relaxed text-foreground">{latest.body}</p>
      {latest.occurred_at ? (
        <p className="text-2xs text-muted-foreground">
          {t`Happened ${fmtDateTime(latest.occurred_at)}`}
        </p>
      ) : null}
      {withdrawn && entry.withdrawn_at ? (
        <p className="text-2xs leading-snug text-muted-foreground">
          {t`Withdrawn ${fmtDateTime(entry.withdrawn_at)} · ${entry.withdraw_reason}`}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCorrect}>
            {t`Correct`}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onWithdraw}>
            {t`Withdraw`}
          </Button>
        </div>
      )}
      {earlier.length > 0 ? (
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-2xs font-medium text-muted-foreground">{t`Earlier revisions`}</p>
          <ul className="flex flex-col gap-1 ps-1" aria-label={t`Earlier revisions`}>
            {earlier.map((r) => (
              <li key={r.id} className="text-2xs leading-snug text-muted-foreground">
                <span className="font-medium tabular-nums">{t`Revision ${r.seq}`}</span>
                {` · ${r.body}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
