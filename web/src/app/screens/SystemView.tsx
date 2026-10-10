import { t } from "@lingui/core/macro";
import { Compass, History, Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Route } from "@/routes/system";
import { Card } from "@/components/Card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { FormTextarea } from "@/components/FormInput";
import { Page } from "@/components/Page";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RuleEditor } from "@/components/system-map/RuleEditor";
import { SystemInspector } from "@/components/system-map/SystemInspector";
import { SystemMap } from "@/components/system-map/SystemMap";
import { SystemMapList } from "@/components/system-map/SystemMapList";
import type {
  ChangeBody,
  ChangeReason,
  DecisionId,
  Rule,
  Stance,
  SystemPart,
  SystemVersion,
  SystemVersionBody,
} from "@/lib/api/system";
import { cn } from "@/lib/cn";
import {
  useActivateSystemVersion,
  useDiscardSystemDraft,
  useSaveSystemVersion,
  useStartSystemVersion,
  useTradingSystem,
} from "@/lib/hooks/useSystem";
import {
  CHANGE_REASONS,
  changedDecisions,
  changeReasonCopy,
  DECISIONS,
  emptyRule,
  planStepCopy,
} from "@/lib/system";
import { decisionsForNode, isMapNodeId, type MapNodeId, STARTER_DECISIONS } from "@/lib/system-map";
import { SystemReviewPanel } from "./SystemReviewPanel";

const failMessage = (err: unknown) => (err instanceof Error ? err.message : t`Request failed`);

function emptyRules(): Record<DecisionId, Rule> {
  return Object.fromEntries(DECISIONS.map((d) => [d, emptyRule()])) as Record<DecisionId, Rule>;
}

export function SystemView() {
  const systemQ = useTradingSystem();
  const [tab, setTab] = useState<"map" | "review">("map");
  const sys = systemQ.data;

  return (
    <Page fill>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{t`Trading system`}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t`Write the rules you trade by on the map, follow them trade by trade, and let the results tell you which rules to keep.`}
          </p>
        </div>
        {sys && (sys.active || sys.draft) ? (
          <SegmentedControl
            ariaLabel={t`System view`}
            value={tab}
            onChange={(v) => setTab(v as "map" | "review")}
            options={[
              { value: "map", label: t`Rules` },
              { value: "review", label: t`Review` },
            ]}
          />
        ) : null}
      </header>

      {systemQ.isLoading ? <Skeleton className="h-64" /> : null}
      {systemQ.isError ? (
        <EmptyState
          icon={<Compass />}
          title={t`Could not load the system`}
          hint={failMessage(systemQ.error)}
          actions={
            <Button type="button" onClick={() => systemQ.refetch()}>
              {t`Retry`}
            </Button>
          }
        />
      ) : null}

      {sys && tab === "review" ? <SystemReviewPanel /> : null}
      {sys && tab === "map" ? <SystemMapWorkspace systemId={sys.id} /> : null}
    </Page>
  );
}

function SystemMapWorkspace({ systemId }: { systemId: string }) {
  const toast = useToastManager();
  const systemQ = useTradingSystem();
  const sys = systemQ.data!;
  const start = useStartSystemVersion();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  void systemId;

  const versions = useMemo(() => {
    const list: SystemVersion[] = [];
    if (sys.draft) list.push(sys.draft);
    if (sys.active) list.push(sys.active);
    list.push(...sys.history);
    return list;
  }, [sys]);

  const selectedVersionId =
    (search?.version && versions.find((v) => v.id === search.version)?.id) ||
    sys.draft?.id ||
    sys.active?.id ||
    versions[0]?.id ||
    null;

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;

  if (!selectedVersion) {
    return (
      <EmptyState
        icon={<Compass />}
        title={t`No rules yet`}
        hint={t`Start with four questions: when do you enter, how much do you risk, when do you exit, and when do you pause.`}
        actions={
          <Button
            type="button"
            disabled={start.isPending}
            onClick={() =>
              start.mutate(undefined, {
                onSuccess: () => toast.add({ title: t`Draft started` }),
                onError: (e) =>
                  toast.add({ title: t`Could not start`, description: failMessage(e) }),
              })
            }
          >
            <Plus className="size-4" />
            {t`Start v1.0`}
          </Button>
        }
      />
    );
  }

  return (
    <VersionEditor
      key={`${selectedVersion.id}:${selectedVersion.updated_at}`}
      selectedVersion={selectedVersion}
      versions={versions}
      sys={sys}
      search={search}
      navigate={navigate}
    />
  );
}

function versionToBody(v: SystemVersion): SystemVersionBody {
  return {
    label: v.label,
    rules: { ...emptyRules(), ...v.rules },
    open_questions: { ...v.open_questions },
    regimes: { ...v.regimes },
    trade_types: { ...v.trade_types },
  };
}

function VersionEditor({
  selectedVersion,
  versions,
  sys,
  search,
  navigate,
}: {
  selectedVersion: SystemVersion;
  versions: SystemVersion[];
  sys: NonNullable<ReturnType<typeof useTradingSystem>["data"]>;
  search: { node?: MapNodeId; version?: string };
  navigate: ReturnType<typeof Route.useNavigate>;
}) {
  const toast = useToastManager();
  const start = useStartSystemVersion();
  const save = useSaveSystemVersion();
  const discard = useDiscardSystemDraft();
  const activate = useActivateSystemVersion();
  const readonly = selectedVersion.status !== "draft";
  const [draftBody, setDraftBody] = useState(() => versionToBody(selectedVersion));
  const [dirtyPrompt, setDirtyPrompt] = useState<null | (() => void)>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateSeed, setActivateSeed] = useState(0);

  const dirty = useMemo(() => {
    if (readonly) return false;
    return JSON.stringify(draftBody) !== JSON.stringify(versionToBody(selectedVersion));
  }, [draftBody, selectedVersion, readonly]);

  const node: MapNodeId = isMapNodeId(search?.node) ? search.node! : "market";

  const setNode = (next: MapNodeId) => {
    const go = () => {
      void navigate({
        search: (prev) => ({ ...prev, node: next }),
        replace: true,
      });
    };
    if (dirty) setDirtyPrompt(() => go);
    else go();
  };

  const setVersion = (id: string) => {
    const go = () => {
      void navigate({
        search: (prev) => ({ ...prev, version: id }),
        replace: true,
      });
    };
    if (dirty) setDirtyPrompt(() => go);
    else go();
  };

  const resetDraft = () => setDraftBody(versionToBody(selectedVersion));
  const decisions = decisionsForNode(node);

  return (
    <>
      <Card
        title={t`Four-week plan`}
        description={t`Progress is derived from your data — not a checklist you tick.`}
      >
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sys.plan.map((step) => {
            const copy = planStepCopy(step.key);
            return (
              <li key={step.key} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{copy.title}</span>
                  <span className="text-2xs tabular-nums text-muted-foreground">
                    {step.progress}/{step.target}
                  </span>
                </div>
                <p className="mt-1 text-2xs text-muted-foreground">{copy.detail}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full bg-primary transition-all", step.done && "bg-primary")}
                    style={{ width: `${Math.min(100, (100 * step.progress) / step.target)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={selectedVersion.id}
          onChange={(e) => setVersion(e.target.value)}
          aria-label={t`Version`}
        >
          {versions.map((v) => (
            <NativeSelectOption key={v.id} value={v.id}>
              {v.label} · {v.status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {readonly ? (
          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
            <Lock className="size-3.5" />
            {t`Read-only`}
          </span>
        ) : null}
        {!sys.draft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={start.isPending}
            onClick={() =>
              start.mutate(undefined, {
                onError: (e) =>
                  toast.add({ title: t`Could not start`, description: failMessage(e) }),
              })
            }
          >
            <Plus className="size-4" />
            {t`Start next version`}
          </Button>
        ) : null}
        {sys.draft && selectedVersion.id === sys.draft.id ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() =>
                save.mutate(
                  { id: sys.draft!.id, body: draftBody },
                  {
                    onSuccess: () => toast.add({ title: t`Draft saved` }),
                    onError: (e) =>
                      toast.add({ title: t`Could not save`, description: failMessage(e) }),
                  },
                )
              }
            >
              {t`Save`}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!dirty} onClick={resetDraft}>
              {t`Cancel edits`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={activate.isPending}
              onClick={() => {
                setActivateSeed((n) => n + 1);
                setActivateOpen(true);
              }}
            >
              {t`Activate`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={discard.isPending}
              onClick={() => {
                if (!confirm(t`Discard this draft? This cannot be undone.`)) return;
                discard.mutate(sys.draft!.id, {
                  onSuccess: () => toast.add({ title: t`Draft discarded` }),
                  onError: (e) =>
                    toast.add({ title: t`Could not discard`, description: failMessage(e) }),
                });
              }}
            >
              {t`Discard draft`}
            </Button>
          </>
        ) : null}
      </div>

      {!sys.active && sys.draft ? (
        <p className="text-2xs text-muted-foreground">
          {t`Starter prompts:`} {STARTER_DECISIONS.map((d) => d).join(", ")} —{" "}
          {t`fill these first; the rest can wait.`}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)] lg:items-start">
        <Card flush fill>
          <div className="hidden md:block">
            <SystemMap
              rules={draftBody.rules}
              openQuestions={draftBody.open_questions}
              selected={node}
              onSelect={setNode}
            />
          </div>
          <div className="p-3 md:hidden">
            <SystemMapList
              rules={draftBody.rules}
              openQuestions={draftBody.open_questions}
              selected={node}
              onSelect={setNode}
            />
          </div>
        </Card>
        <Card
          title={t`Rules`}
          description={
            readonly ? t`Historical versions are read-only.` : t`Edit the selected node.`
          }
        >
          <SystemInspector panelKey={node}>
            <RuleEditor
              decisions={decisions}
              rules={draftBody.rules}
              openQuestions={draftBody.open_questions}
              regimes={draftBody.regimes}
              tradeTypes={draftBody.trade_types}
              readonly={readonly}
              version={selectedVersion}
              onRuleChange={(id, patch) =>
                setDraftBody((b) => ({
                  ...b,
                  rules: { ...b.rules, [id]: { ...emptyRule(), ...b.rules[id], ...patch } },
                }))
              }
              onOpenQuestion={(part: SystemPart, text) =>
                setDraftBody((b) => ({
                  ...b,
                  open_questions: { ...b.open_questions, [part]: text },
                }))
              }
              onRegimeLabel={(stance: Stance, label) =>
                setDraftBody((b) => ({ ...b, regimes: { ...b.regimes, [stance]: label } }))
              }
              onTradeTypeLabel={(key, label) =>
                setDraftBody((b) => ({
                  ...b,
                  trade_types: { ...b.trade_types, [key]: label },
                }))
              }
            />
          </SystemInspector>
        </Card>
      </div>

      {sys.history.length > 0 ? (
        <Card title={t`History`} action={<History className="size-4 text-muted-foreground" />}>
          <ul className="flex flex-col gap-1 text-sm">
            {sys.history.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="rounded-md px-2 py-1.5 hover:bg-accent"
                  onClick={() => setVersion(v.id)}
                >
                  {v.label}
                  <span className="ms-2 text-2xs text-muted-foreground">{v.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <DirtyDialog
        open={dirtyPrompt != null}
        onStay={() => setDirtyPrompt(null)}
        onDiscard={() => {
          resetDraft();
          const go = dirtyPrompt;
          setDirtyPrompt(null);
          go?.();
        }}
        onSave={() => {
          if (!sys.draft || !draftBody) return;
          save.mutate(
            { id: sys.draft.id, body: draftBody },
            {
              onSuccess: () => {
                const go = dirtyPrompt;
                setDirtyPrompt(null);
                go?.();
              },
              onError: (e) => toast.add({ title: t`Could not save`, description: failMessage(e) }),
            },
          );
        }}
      />

      <ActivateDialog
        key={activateSeed}
        open={activateOpen}
        onOpenChange={setActivateOpen}
        draft={sys.draft}
        active={sys.active}
        body={draftBody}
        pending={activate.isPending}
        onConfirm={(changes) => {
          if (!sys.draft) return;
          activate.mutate(
            { id: sys.draft.id, changes },
            {
              onSuccess: () => {
                setActivateOpen(false);
                toast.add({ title: t`Version activated` });
              },
              onError: (e) =>
                toast.add({ title: t`Could not activate`, description: failMessage(e) }),
            },
          );
        }}
      />
    </>
  );
}

function DirtyDialog({
  open,
  onStay,
  onDiscard,
  onSave,
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onStay()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Unsaved changes`}</DialogTitle>
          <DialogDescription>
            {t`Save, discard, or keep editing before leaving this node or version.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onStay}>
            {t`Keep editing`}
          </Button>
          <Button type="button" variant="outline" onClick={onDiscard}>
            {t`Discard`}
          </Button>
          <Button type="button" onClick={onSave}>
            {t`Save`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivateDialog({
  open,
  onOpenChange,
  draft,
  active,
  body,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: SystemVersion | null;
  active: SystemVersion | null;
  body: SystemVersionBody;
  pending: boolean;
  onConfirm: (changes: ChangeBody[]) => void;
}) {
  const changed = active ? changedDecisions(active.rules, body.rules) : [];
  const [reasons, setReasons] = useState<Record<string, { reason: ChangeReason; note: string }>>(
    () =>
      Object.fromEntries(changed.map((d) => [d, { reason: "other" as ChangeReason, note: "" }])),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t`Activate ${draft?.label ?? ""}`}</DialogTitle>
          <DialogDescription>
            {changed.length
              ? t`Give a reason for each changed decision. The previous active version becomes read-only history.`
              : t`This becomes the active system. You can revise later with a new draft.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {changed.map((d) => (
            <div key={d} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3">
              <div className="text-sm font-medium">{d}</div>
              <NativeSelect
                value={reasons[d]?.reason ?? "other"}
                onChange={(e) =>
                  setReasons((r) => ({
                    ...r,
                    [d]: {
                      ...r[d],
                      reason: e.target.value as ChangeReason,
                      note: r[d]?.note ?? "",
                    },
                  }))
                }
              >
                {CHANGE_REASONS.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {changeReasonCopy(r).label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FormTextarea
                rows={2}
                placeholder={t`Note (optional)`}
                value={reasons[d]?.note ?? ""}
                onChange={(e) =>
                  setReasons((r) => ({
                    ...r,
                    [d]: {
                      reason: r[d]?.reason ?? "other",
                      note: e.target.value,
                    },
                  }))
                }
              />
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t`Cancel`}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              onConfirm(
                changed.map((d) => ({
                  decision: d,
                  reason: reasons[d]?.reason ?? "other",
                  note: reasons[d]?.note ?? "",
                })),
              )
            }
          >
            {t`Activate`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
