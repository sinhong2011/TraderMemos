import { t } from "@lingui/core/macro";
import {
  ArrowLeft,
  Ban,
  Eye,
  History,
  Hourglass,
  Link2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Unlink,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import { AmountInput } from "@/components/AmountInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import { Field } from "@/components/Field";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type {
  ConditionAnswer,
  DecisionId,
  PlanEvent,
  PlanRevision,
  PlanStatus,
  SystemPlan,
  SystemPlanDetail,
  SystemVersion,
  TradingSystem,
} from "@/lib/api/system";
import { parseAmountToNumber } from "@/lib/amountInput";
import { cn } from "@/lib/cn";
import { fmtDateShort, fmtDateTime } from "@/lib/format";
import {
  useAddPlanRevision,
  useCreateSystemPlan,
  useLinkPlanTrade,
  useSetPlanStatus,
  useSystemPlan,
  useSystemPlans,
  useUnlinkPlanTrade,
} from "@/lib/hooks/useSystem";
import { intlLocale } from "@/lib/locale";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";
import { decisionCopy, DECISIONS } from "@/lib/system";
import { decisionsForNode, type MapNodeId } from "@/lib/system-map";
import {
  answerLabel,
  draftFromRevision,
  draftToBody,
  isClosedStatus,
  nodeCheck,
  nodeChecks,
  planPricing,
  planStatusLabel,
  planStatusTone,
  samePlanDraft,
  type PlanDraft,
} from "@/lib/system-plan";
import { FollowTradeInspector } from "./FollowTradeInspector";
import { EvidenceTimeline } from "./EvidenceTimeline";
import { InspectorFrame, InspectorSection } from "./InspectorFrame";
import { directionLabel, LinkTradeDialog, NewPlanDialog, ReasonDialog } from "./PlanDialogs";
import { SystemInspector } from "./SystemInspector";
import { SystemMap } from "./SystemMap";
import { SystemMapList } from "./SystemMapList";
import { CheckPill, NodeIcon, systemNodeTitle } from "./SystemNode";
import { WorkspaceGrid } from "./WorkspaceGrid";

const failMessage = (err: unknown) => (err instanceof Error ? err.message : t`Request failed`);

type ReasonKind = "skipped" | "cancelled" | "planned" | "unlink";

function decisionIndex(id: DecisionId): number {
  const i = DECISIONS.indexOf(id);
  return i >= 0 ? i + 1 : 0;
}

function stageLabel(stage: PlanRevision["stage"]): string {
  return stage === "after_fill" ? t`After fill` : t`Before fill`;
}

function planOptionLabel(p: SystemPlan): string {
  return `${p.symbol} · ${directionLabel(p.direction)} · ${planStatusLabel(p.status)} · ${fmtDateShort(p.created_at)}`;
}

/** Most recent open plan, else the newest one. */
function defaultPlanId(plans: SystemPlan[]): string | null {
  return (
    (plans.find((p) => p.status === "planned" || p.status === "waiting") ?? plans[0])?.id ?? null
  );
}

export function PlanStatusPill({ status }: { status: PlanStatus }) {
  const tone = planStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium",
        tone.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {planStatusLabel(status)}
    </span>
  );
}

export function FollowPlanWorkspace({
  sys,
  versions,
  fallbackVersion,
  node,
  onNodeChange,
  planParam,
  onPlanChange,
  onEditDraft,
  onDirtyChange,
}: {
  sys: TradingSystem;
  versions: SystemVersion[];
  /** Rules shown when no plan is open. */
  fallbackVersion: SystemVersion;
  node: MapNodeId;
  onNodeChange: (node: MapNodeId) => void;
  planParam: string | undefined;
  onPlanChange: (id: string) => void;
  onEditDraft: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const toast = useToastManager();
  const plansQ = useSystemPlans();
  const plans = plansQ.data ?? [];
  const planId = planParam ?? defaultPlanId(plans);
  const detailQ = useSystemPlan(planId);
  const detail = detailQ.data?.id === planId ? detailQ.data : null;

  const create = useCreateSystemPlan();
  const addRevision = useAddPlanRevision();
  const setStatus = useSetPlanStatus();
  const link = useLinkPlanTrade();
  const unlink = useUnlinkPlanTrade();

  const baseKey = detail ? `${detail.id}:${detail.latest?.seq ?? 0}` : "";
  const [draftState, setDraftState] = useState(() => ({
    key: baseKey,
    draft: draftFromRevision(detail?.latest),
  }));
  if (draftState.key !== baseKey) {
    setDraftState({ key: baseKey, draft: draftFromRevision(detail?.latest) });
  }
  const saved = draftFromRevision(detail?.latest);
  const draft = draftState.key === baseKey ? draftState.draft : saved;
  const dirty = detail != null && !samePlanDraft(draft, saved);
  const patchDraft = (patch: Partial<PlanDraft>) =>
    setDraftState((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
  const discardEdits = () => setDraftState({ key: baseKey, draft: saved });

  useLayoutEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const [view, setView] = useState<{ planId: string; seq: number } | null>(null);
  const viewing =
    detail && view?.planId === detail.id && view.seq !== detail.latest?.seq
      ? (detail.revisions.find((r) => r.seq === view.seq) ?? null)
      : null;
  const closed = detail ? isClosedStatus(detail.status) : false;
  const readonly = closed || viewing != null;

  const [pending, setPending] = useState<null | (() => void)>(null);
  const guard = (go: () => void) => {
    if (dirty) setPending(() => go);
    else go();
  };

  const [newOpen, setNewOpen] = useState(false);
  const [newSeed, setNewSeed] = useState(0);
  const [reasonFor, setReasonFor] = useState<ReasonKind | null>(null);
  const [reasonSeed, setReasonSeed] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSeed, setLinkSeed] = useState(0);

  const planVersion =
    (detail && versions.find((v) => v.id === detail.version_id)) || sys.active || fallbackVersion;
  const mapVersion = detail ? planVersion : fallbackVersion;
  const shownConditions = (viewing ?? (detail ? draftToBody(draft) : null))?.conditions;
  const checks = detail ? nodeChecks(shownConditions) : undefined;

  const pricing = planPricing(
    detail?.direction ?? "long",
    parseAmountToNumber(draft.entry),
    parseAmountToNumber(draft.stop),
    parseAmountToNumber(draft.target),
  );

  const saveRevision = (after?: () => void) => {
    if (!detail) return;
    if (pricing.problem) {
      toast.add({ title: t`Fix the prices first`, description: pricing.problem });
      return;
    }
    addRevision.mutate(
      { id: detail.id, body: draftToBody(draft) },
      {
        onSuccess: (p) => {
          toast.add({ title: t`Revision ${p.latest?.seq ?? ""} saved` });
          after?.();
        },
        onError: (e) => toast.add({ title: t`Could not save`, description: failMessage(e) }),
      },
    );
  };

  const changeStatus = (status: PlanStatus, reason = "") => {
    if (!detail) return;
    setStatus.mutate(
      { id: detail.id, status, reason },
      {
        onSuccess: () => {
          setReasonFor(null);
          toast.add({ title: t`Plan marked ${planStatusLabel(status).toLowerCase()}` });
        },
        onError: (e) => toast.add({ title: t`Could not update`, description: failMessage(e) }),
      },
    );
  };

  const openNew = () =>
    guard(() => {
      setNewSeed((n) => n + 1);
      setNewOpen(true);
    });

  const lockedByEdits = dirty ? t`Save or discard your edits first` : undefined;

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 0 ? (
            <NativeSelect
              value={planId ?? ""}
              aria-label={t`Plan`}
              onChange={(e) => {
                const id = e.target.value;
                guard(() => onPlanChange(id));
              }}
            >
              {plans.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {planOptionLabel(p)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
          <Button
            type="button"
            variant={plans.length ? "outline" : "default"}
            size="sm"
            disabled={!sys.active}
            title={sys.active ? undefined : t`Activate a version before planning trades`}
            onClick={openNew}
          >
            <Plus className="size-4" aria-hidden />
            {t`New plan`}
          </Button>
          {detail ? (
            <>
              <PlanStatusPill status={detail.status} />
              {detail.source === "retrospective" ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-2xs font-medium text-muted-foreground">
                  {t`Written after the fact`}
                </span>
              ) : null}
              <span className="text-2xs text-muted-foreground">
                {t`Checked against ${detail.version_label || "—"} · revision ${detail.latest?.seq ?? 0}`}
              </span>
            </>
          ) : null}
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-warning-foreground">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden />
              {t`Unsaved changes`}
            </span>
          ) : null}

          {detail ? (
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {detail.status === "planned" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={setStatus.isPending}
                  onClick={() => changeStatus("waiting")}
                >
                  <Hourglass className="size-3.5" aria-hidden />
                  {t`Waiting for trigger`}
                </Button>
              ) : null}
              {detail.status === "waiting" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={setStatus.isPending}
                  onClick={() => changeStatus("planned")}
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  {t`Back to planned`}
                </Button>
              ) : null}
              {detail.status === "planned" || detail.status === "waiting" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dirty}
                  title={lockedByEdits}
                  onClick={() => {
                    setLinkSeed((n) => n + 1);
                    setLinkOpen(true);
                  }}
                >
                  <Link2 className="size-3.5" aria-hidden />
                  {t`Link trade`}
                </Button>
              ) : null}
              {closed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReasonSeed((n) => n + 1);
                    setReasonFor("planned");
                  }}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  {t`Reopen`}
                </Button>
              ) : null}
              {dirty ? (
                <Button type="button" variant="ghost" size="sm" onClick={discardEdits}>
                  {t`Discard edits`}
                </Button>
              ) : null}
              {!closed ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || addRevision.isPending}
                  onClick={() => saveRevision()}
                >
                  <Save className="size-3.5" aria-hidden />
                  {addRevision.isPending ? t`Saving…` : t`Save revision`}
                </Button>
              ) : null}
              {!closed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t`More plan actions`}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {detail.status === "taken" ? (
                      <DropdownMenuItem
                        disabled={dirty}
                        onClick={() => {
                          setReasonSeed((n) => n + 1);
                          setReasonFor("unlink");
                        }}
                      >
                        <Unlink size={14} />
                        {t`Unlink trade…`}
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          disabled={dirty}
                          onClick={() => {
                            setReasonSeed((n) => n + 1);
                            setReasonFor("skipped");
                          }}
                        >
                          <SkipForward size={14} />
                          {t`Skip this trade…`}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={dirty}
                          onClick={() => {
                            setReasonSeed((n) => n + 1);
                            setReasonFor("cancelled");
                          }}
                        >
                          <Ban size={14} />
                          {t`Cancel plan…`}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ) : null}
        </div>
        {!detail && plans.length === 0 && !plansQ.isLoading ? (
          <p className="text-sm text-muted-foreground">
            {t`Write a plan before the fill, then walk the map and answer each rule.`}
          </p>
        ) : null}
      </div>

      <WorkspaceGrid
        map={
          <SystemMap
            systemId={sys.id}
            rules={mapVersion.rules}
            openQuestions={mapVersion.open_questions}
            selected={node}
            onSelect={onNodeChange}
            checks={checks}
          />
        }
        list={
          <SystemMapList
            rules={mapVersion.rules}
            openQuestions={mapVersion.open_questions}
            selected={node}
            onSelect={onNodeChange}
            checks={checks}
          />
        }
        inspector={
          planId && !detail && detailQ.isLoading ? (
            <Skeleton className="h-full min-h-64" />
          ) : detail ? (
            <SystemInspector panelKey={`plan-${detail.id}-${node}`}>
              <PlanInspector
                node={node}
                plan={detail}
                version={planVersion}
                draft={viewing ? draftFromRevision(viewing) : draft}
                onDraft={patchDraft}
                readonly={readonly}
                viewing={viewing}
                pricingProblem={viewing ? null : pricing.problem}
                r={viewing ? null : pricing.r}
                onView={(seq) => setView(seq == null ? null : { planId: detail.id, seq })}
                onShowHistory={() => onNodeChange("review")}
                onEditDraft={onEditDraft}
              />
            </SystemInspector>
          ) : (
            <SystemInspector panelKey={`follow-${node}`}>
              <FollowTradeInspector
                node={node}
                version={fallbackVersion}
                onEditDraft={onEditDraft}
                onNewPlan={sys.active ? openNew : undefined}
              />
            </SystemInspector>
          )
        }
      />

      <NewPlanDialog
        key={`new-${newSeed}`}
        open={newOpen}
        onOpenChange={setNewOpen}
        versionLabel={sys.active?.label ?? ""}
        pending={create.isPending}
        onCreate={(body) =>
          create.mutate(body, {
            onSuccess: (p) => {
              setNewOpen(false);
              onPlanChange(p.id);
              toast.add({ title: t`Plan created` });
            },
            onError: (e) =>
              toast.add({ title: t`Could not create the plan`, description: failMessage(e) }),
          })
        }
      />

      {detail ? (
        <>
          <ReasonDialog
            key={`reason-${reasonSeed}`}
            open={reasonFor != null}
            onOpenChange={(v) => !v && setReasonFor(null)}
            title={reasonCopy(reasonFor, detail).title}
            description={reasonCopy(reasonFor, detail).description}
            confirmLabel={reasonCopy(reasonFor, detail).confirm}
            destructive={reasonFor === "cancelled" || reasonFor === "unlink"}
            pending={setStatus.isPending || unlink.isPending}
            onConfirm={(reason) => {
              if (reasonFor === "unlink") {
                unlink.mutate(
                  { id: detail.id, reason },
                  {
                    onSuccess: () => {
                      setReasonFor(null);
                      toast.add({ title: t`Trade unlinked` });
                    },
                    onError: (e) =>
                      toast.add({ title: t`Could not unlink`, description: failMessage(e) }),
                  },
                );
              } else if (reasonFor) {
                changeStatus(reasonFor, reason);
              }
            }}
          />
          <LinkTradeDialog
            key={`link-${linkSeed}`}
            open={linkOpen}
            onOpenChange={setLinkOpen}
            plan={detail}
            pending={link.isPending}
            onLink={(tradeId) =>
              link.mutate(
                { id: detail.id, tradeId },
                {
                  onSuccess: () => {
                    setLinkOpen(false);
                    toast.add({ title: t`Trade linked` });
                  },
                  onError: (e) =>
                    toast.add({ title: t`Could not link`, description: failMessage(e) }),
                },
              )
            }
          />
        </>
      ) : null}

      <Dialog open={pending != null} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="max-w-[min(480px,94vw)]">
          <DialogHeader className="flex-col items-start gap-1.5 pr-12">
            <DialogTitle>{t`Unsaved plan edits`}</DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {t`Save them as a new revision, discard them, or keep editing.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              {t`Keep editing`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const go = pending;
                setPending(null);
                discardEdits();
                go?.();
              }}
            >
              {t`Discard`}
            </Button>
            <Button
              type="button"
              disabled={addRevision.isPending}
              onClick={() =>
                saveRevision(() => {
                  const go = pending;
                  setPending(null);
                  go?.();
                })
              }
            >
              {t`Save revision`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function reasonCopy(
  kind: ReasonKind | null,
  plan: SystemPlan,
): { title: string; description: string; confirm: string } {
  switch (kind) {
    case "skipped":
      return {
        title: t`Skip ${plan.symbol}?`,
        description: t`The setup came but you passed. Say why — it's how hesitation shows up in review.`,
        confirm: t`Skip trade`,
      };
    case "cancelled":
      return {
        title: t`Cancel this plan?`,
        description: t`The opportunity is gone or no longer valid. The plan and its revisions stay in history.`,
        confirm: t`Cancel plan`,
      };
    case "planned":
      return {
        title: t`Reopen ${plan.symbol}?`,
        description: t`It goes back to planned so you can revise it and link a fill.`,
        confirm: t`Reopen`,
      };
    case "unlink":
      return {
        title: t`Unlink the trade?`,
        description: t`The plan returns to waiting and the trade is free to confirm another plan. The link stays in history.`,
        confirm: t`Unlink`,
      };
    default:
      return { title: "", description: "", confirm: "" };
  }
}

const ANSWER_OPTIONS: { value: string; answer: ConditionAnswer }[] = [
  { value: "open", answer: "" },
  { value: "yes", answer: "yes" },
  { value: "no", answer: "no" },
  { value: "na", answer: "na" },
];

function ConditionRow({
  decision,
  ruleText,
  answer,
  note,
  readonly,
  onChange,
}: {
  decision: DecisionId;
  ruleText: string;
  answer: ConditionAnswer;
  note: string;
  readonly: boolean;
  onChange: (answer: ConditionAnswer, note: string) => void;
}) {
  const title = decisionCopy(decision).title;
  const noteId = useId();
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="text-2xs font-medium text-muted-foreground">
        {t`Decision ${decisionIndex(decision)} · ${title}`}
      </div>
      <p
        className={
          ruleText ? "text-sm leading-relaxed text-foreground" : "text-sm text-muted-foreground/80"
        }
      >
        {ruleText || t`Not written yet.`}
      </p>
      {readonly ? (
        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-foreground">{answerLabel(answer)}</span>
          {note ? <p className="text-2xs leading-snug text-muted-foreground">{note}</p> : null}
        </div>
      ) : (
        <>
          <SegmentedControl
            ariaLabel={t`Answer for ${title}`}
            size="xs"
            fullWidth
            value={ANSWER_OPTIONS.find((o) => o.answer === answer)?.value ?? "open"}
            onChange={(v) =>
              onChange(ANSWER_OPTIONS.find((o) => o.value === v)?.answer ?? "", note)
            }
            tones={{ yes: "pos", no: "neg" }}
            options={[
              { value: "open", label: t`No answer` },
              { value: "yes", label: t`Met` },
              { value: "no", label: t`Not met` },
              { value: "na", label: t`N/A` },
            ]}
          />
          <label htmlFor={noteId} className="sr-only">
            {t`What you saw for ${title}`}
          </label>
          <FormInput
            id={noteId}
            value={note}
            maxLength={500}
            placeholder={t`What you saw (optional)`}
            onChange={(e) => onChange(answer, e.target.value)}
          />
        </>
      )}
    </li>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-medium text-muted-foreground">{label}</span>
      <p
        className={cn(
          "text-sm leading-relaxed whitespace-pre-wrap",
          value ? "text-foreground" : "text-muted-foreground/80",
        )}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function PlanFields({
  node,
  plan,
  draft,
  onDraft,
  readonly,
  pricingProblem,
  r,
}: {
  node: MapNodeId;
  plan: SystemPlanDetail;
  draft: PlanDraft;
  onDraft: (patch: Partial<PlanDraft>) => void;
  readonly: boolean;
  pricingProblem: string | null;
  r: number | null;
}) {
  const ids = { setup: useId(), thesis: useId(), trigger: useId(), invalidation: useId() };
  const priceIds = { entry: useId(), stop: useId(), target: useId() };

  if (node === "entry") {
    if (readonly) {
      return (
        <div className="flex flex-col gap-3">
          <ReadonlyField label={t`Setup`} value={draft.setup} />
          <ReadonlyField label={t`Thesis`} value={draft.thesis} />
          <ReadonlyField label={t`Trigger`} value={draft.trigger} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <Field label={t`Setup`} htmlFor={ids.setup}>
          <FormInput
            id={ids.setup}
            value={draft.setup}
            placeholder={t`e.g. Flat base, 7 weeks`}
            onChange={(e) => onDraft({ setup: e.target.value })}
          />
        </Field>
        <Field label={t`Thesis`} htmlFor={ids.thesis}>
          <FormTextarea
            id={ids.thesis}
            rows={2}
            value={draft.thesis}
            placeholder={t`Why this, why now`}
            onChange={(e) => onDraft({ thesis: e.target.value })}
          />
        </Field>
        <Field label={t`Trigger`} htmlFor={ids.trigger}>
          <FormTextarea
            id={ids.trigger}
            rows={2}
            value={draft.trigger}
            placeholder={t`The exact event that gets you in`}
            onChange={(e) => onDraft({ trigger: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  if (node === "risk") {
    const hint =
      pricingProblem ??
      (r != null ? t`Planned ${r.toFixed(2)}R` : t`Entry, stop and target price the plan in R.`);
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          {readonly ? (
            <>
              <ReadonlyField label={t`Entry`} value={draft.entry} />
              <ReadonlyField label={t`Stop`} value={draft.stop} />
              <ReadonlyField label={t`Target`} value={draft.target} />
            </>
          ) : (
            <>
              <Field label={t`Entry`} htmlFor={priceIds.entry}>
                <AmountInput
                  id={priceIds.entry}
                  value={draft.entry}
                  onValueChange={(v) => onDraft({ entry: v })}
                />
              </Field>
              <Field label={t`Stop`} htmlFor={priceIds.stop}>
                <AmountInput
                  id={priceIds.stop}
                  value={draft.stop}
                  onValueChange={(v) => onDraft({ stop: v })}
                />
              </Field>
              <Field label={t`Target`} htmlFor={priceIds.target}>
                <AmountInput
                  id={priceIds.target}
                  value={draft.target}
                  onValueChange={(v) => onDraft({ target: v })}
                />
              </Field>
            </>
          )}
        </div>
        <p
          className={cn(
            "text-2xs",
            pricingProblem ? "text-destructive-foreground" : "text-muted-foreground",
          )}
        >
          {directionLabel(plan.direction)} · {hint}
        </p>
      </div>
    );
  }

  if (node === "holding") {
    if (readonly) return <ReadonlyField label={t`Invalidation`} value={draft.invalidation} />;
    return (
      <Field label={t`Invalidation`} htmlFor={ids.invalidation}>
        <FormTextarea
          id={ids.invalidation}
          rows={2}
          value={draft.invalidation}
          placeholder={t`What proves the idea wrong`}
          onChange={(e) => onDraft({ invalidation: e.target.value })}
        />
      </Field>
    );
  }

  return null;
}

function eventText(e: PlanEvent): string {
  if (e.kind === "link") return t`Linked a trade`;
  if (e.kind === "unlink") return t`Unlinked the trade`;
  if (!e.from_status && e.to_status) return t`Plan written`;
  const from = e.from_status ? planStatusLabel(e.from_status) : "";
  const to = e.to_status ? planStatusLabel(e.to_status) : "";
  return t`${from} → ${to}`;
}

function PlanHistory({
  plan,
  viewingSeq,
  onView,
}: {
  plan: SystemPlanDetail;
  viewingSeq: number | null;
  onView: (seq: number | null) => void;
}) {
  const latestSeq = plan.latest?.seq ?? 0;
  const revisions = [...plan.revisions].reverse();
  const events = [...plan.events].reverse();
  return (
    <>
      <InspectorSection title={t`Revisions`}>
        <ul className="flex flex-col gap-1" aria-label={t`Revisions`}>
          {revisions.map((r) => {
            const isLatest = r.seq === latestSeq;
            const isViewing = viewingSeq === r.seq || (viewingSeq == null && isLatest);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  aria-current={isViewing ? "true" : undefined}
                  onClick={() => onView(isLatest ? null : r.seq)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-start transition-colors duration-150 hover:bg-accent",
                    isViewing && "bg-accent",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">
                        {t`Revision ${r.seq}`}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-2xs font-medium",
                          r.stage === "after_fill"
                            ? "bg-info/10 text-info-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {stageLabel(r.stage)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-2xs text-muted-foreground">
                      {t`Recorded ${fmtDateTime(r.recorded_at)}`}
                      {r.occurred_at ? ` · ${t`happened ${fmtDateTime(r.occurred_at)}`}` : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 shrink-0 text-2xs text-muted-foreground">
                    {isViewing ? (
                      <Eye className="size-3.5 text-primary" aria-label={t`Showing`} />
                    ) : isLatest ? (
                      t`Latest`
                    ) : (
                      t`View`
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </InspectorSection>
      <InspectorSection title={t`Activity`}>
        <ol className="flex flex-col gap-2" aria-label={t`Activity`}>
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{eventText(e)}</span>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {fmtDateTime(e.created_at)}
                </span>
              </span>
              {e.reason ? (
                <span className="text-2xs leading-snug text-muted-foreground">“{e.reason}”</span>
              ) : null}
            </li>
          ))}
        </ol>
      </InspectorSection>
    </>
  );
}

function PlanInspector({
  node,
  plan,
  version,
  draft,
  onDraft,
  readonly,
  viewing,
  pricingProblem,
  r,
  onView,
  onShowHistory,
  onEditDraft,
}: {
  node: MapNodeId;
  plan: SystemPlanDetail;
  version: SystemVersion;
  draft: PlanDraft;
  onDraft: (patch: Partial<PlanDraft>) => void;
  readonly: boolean;
  viewing: PlanRevision | null;
  pricingProblem: string | null;
  r: number | null;
  onView: (seq: number | null) => void;
  onShowHistory: () => void;
  onEditDraft: () => void;
}) {
  const { fmtSignedMoney } = useMoneyFormatters();
  const decisions = decisionsForNode(node);
  const check = nodeCheck(decisions, draftToBody(draft).conditions);
  const closed = isClosedStatus(plan.status);
  const hasFields = node === "entry" || node === "risk" || node === "holding";

  return (
    <InspectorFrame
      title={systemNodeTitle(node)}
      subtitle={t`${plan.symbol} · ${directionLabel(plan.direction)} · ${plan.version_label || "—"}`}
      icon={<NodeIcon id={node} className="size-4.5" />}
      meta={
        <>
          <CheckPill check={check} />
          <span className="text-2xs font-medium tabular-nums text-muted-foreground">
            {t`${check.answered} of ${check.total} checked`}
          </span>
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
              variant="secondary"
              onClick={onShowHistory}
              disabled={node === "review"}
            >
              <History className="size-4" aria-hidden />
              {t`Plan history`}
            </Button>
          </div>
          <p className="text-2xs leading-snug text-muted-foreground">
            {t`Follow mode organizes conditions and evidence. It never places orders.`}
          </p>
        </>
      }
    >
      {viewing ? (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-info/10 px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {t`Revision ${viewing.seq} · ${stageLabel(viewing.stage)}`}
            </div>
            <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
              {t`Recorded ${fmtDateTime(viewing.recorded_at)}. Read-only — later revisions never change it.`}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onView(null)}>
            {t`Back to latest`}
          </Button>
        </div>
      ) : closed ? (
        <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-2xs leading-snug text-muted-foreground">
          {t`This plan is ${planStatusLabel(plan.status).toLowerCase()}. Reopen it to keep revising.`}
        </div>
      ) : plan.status === "taken" ? (
        <div className="rounded-lg bg-info/10 px-3 py-2.5 text-2xs leading-snug text-muted-foreground">
          {t`A trade is linked. New revisions are marked after the fill; what you wrote before stays as it was.`}
        </div>
      ) : null}

      {hasFields ? (
        <InspectorSection title={t`Plan`}>
          <PlanFields
            node={node}
            plan={plan}
            draft={draft}
            onDraft={onDraft}
            readonly={readonly}
            pricingProblem={pricingProblem}
            r={r}
          />
        </InspectorSection>
      ) : null}

      {node === "review" ? (
        <InspectorSection title={t`Outcome`}>
          {plan.trade ? (
            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {plan.trade.symbol} · {directionLabel(plan.trade.direction)}
                </div>
                <div className="mt-0.5 text-2xs text-muted-foreground">
                  {t`Opened ${fmtDateTime(plan.trade.opened_at)}`}
                  {plan.trade.closed_at
                    ? ` · ${t`closed ${fmtDateTime(plan.trade.closed_at)}`}`
                    : ""}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {plan.trade.net_pnl != null
                  ? fmtSignedMoney(
                      plan.trade.net_pnl,
                      plan.trade.pnl_currency || "USD",
                      intlLocale(),
                    )
                  : t`Open`}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {plan.status === "skipped"
                ? t`Skipped — no trade.`
                : plan.status === "cancelled"
                  ? t`Cancelled — no trade.`
                  : t`No trade linked yet.`}
            </p>
          )}
        </InspectorSection>
      ) : null}

      {node === "review" ? (
        <EvidenceTimeline planId={plan.id} taken={plan.status === "taken"} />
      ) : null}

      {node === "review" ? (
        <PlanHistory plan={plan} viewingSeq={viewing?.seq ?? null} onView={onView} />
      ) : null}

      <InspectorSection title={t`Check against ${version.label}`}>
        <ul className="flex flex-col gap-2">
          {decisions.map((d) => {
            const c = draft.conditions[d];
            return (
              <ConditionRow
                key={d}
                decision={d}
                ruleText={version.rules?.[d]?.text.trim() ?? ""}
                answer={c?.answer ?? ""}
                note={c?.note ?? ""}
                readonly={readonly}
                onChange={(answer, note) =>
                  onDraft({ conditions: { ...draft.conditions, [d]: { answer, note } } })
                }
              />
            );
          })}
        </ul>
      </InspectorSection>

      {!hasFields && node !== "review" ? (
        <p className="flex items-start gap-1.5 text-2xs leading-snug text-muted-foreground">
          <NotebookPen className="mt-px size-3.5 shrink-0" aria-hidden />
          {t`Setup, trigger and prices live on Entry and Risk; invalidation on Holding.`}
        </p>
      ) : null}
    </InspectorFrame>
  );
}
