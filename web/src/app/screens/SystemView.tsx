import { t } from "@lingui/core/macro";
import { Compass, History, Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Route, type SystemMode } from "@/routes/system";
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
import { systemNodeTitle } from "@/components/system-map/SystemNode";
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
  decisionCopy,
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

function versionStatusLabel(status: SystemVersion["status"]): string {
  switch (status) {
    case "active":
      return t`In use`;
    case "draft":
      return t`Draft`;
    case "retired":
      return t`Retired`;
  }
}

export function SystemView() {
  const systemQ = useTradingSystem();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const sys = systemQ.data;
  const mode: SystemMode = search.mode ?? "rules";
  const hasWorkspace = Boolean(sys && (sys.active || sys.draft || sys.history.length > 0));
  const shownVersion = sys?.draft ?? sys?.active ?? sys?.history[0] ?? null;

  const setMode = (next: SystemMode) => {
    void navigate({
      search: (prev) => ({ ...prev, mode: next === "rules" ? undefined : next }),
      replace: true,
    });
  };

  return (
    <Page fill>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{t`Trading system`}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t`Connect rules, decisions, and evidence.`}
            </p>
          </div>
          {shownVersion ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium",
                  shownVersion.status === "active" && "text-foreground",
                  shownVersion.status === "draft" && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    shownVersion.status === "active" && "bg-success",
                    shownVersion.status === "draft" && "bg-primary",
                    shownVersion.status === "retired" && "bg-muted-foreground",
                  )}
                  aria-hidden
                />
                {shownVersion.label} · {versionStatusLabel(shownVersion.status)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-3.5" />
                {t`Version history`}
              </Button>
            </div>
          ) : null}
        </div>

        {hasWorkspace ? (
          <SegmentedControl
            ariaLabel={t`System mode`}
            value={mode}
            onChange={(v) => setMode(v as SystemMode)}
            options={[
              { value: "rules", label: t`Write rules` },
              { value: "follow", label: t`Follow trade` },
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

      {sys && mode === "follow" ? (
        <EmptyState
          icon={<Compass />}
          title={t`Follow trade comes next`}
          hint={t`Phase C–E will attach a live opportunity or trade to this map: condition checks, evidence timeline, and confirm-trigger on the Entry node. Write rules first.`}
          actions={
            <Button type="button" onClick={() => setMode("rules")}>
              {t`Back to write rules`}
            </Button>
          }
        />
      ) : null}
      {sys && mode === "review" ? <SystemReviewPanel /> : null}
      {sys && mode === "rules" ? <SystemMapWorkspace systemId={sys.id} /> : null}

      {sys ? (
        <VersionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          versions={[
            ...(sys.draft ? [sys.draft] : []),
            ...(sys.active ? [sys.active] : []),
            ...sys.history,
          ]}
          onSelect={(id) => {
            setHistoryOpen(false);
            setMode("rules");
            void navigate({
              search: (prev) => ({ ...prev, version: id, mode: undefined }),
              replace: true,
            });
          }}
        />
      ) : null}
    </Page>
  );
}

function VersionHistoryDialog({
  open,
  onOpenChange,
  versions,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: SystemVersion[];
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Version history`}</DialogTitle>
          <DialogDescription>
            {t`Open a version on the map. Active and retired versions are read-only.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t`No versions yet.`}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-accent"
                    onClick={() => onSelect(v.id)}
                  >
                    <span className="text-sm font-medium">{v.label}</span>
                    <span className="text-2xs text-muted-foreground">
                      {versionStatusLabel(v.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
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
  search: { mode?: SystemMode; node?: MapNodeId; version?: string };
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
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          {sys.plan.map((step) => {
            const copy = planStepCopy(step.key);
            const pct = Math.min(100, (100 * step.progress) / Math.max(1, step.target));
            return (
              <li
                key={step.key}
                className="flex h-full flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{copy.title}</span>
                  <span className="text-2xs tabular-nums text-muted-foreground">
                    {step.progress}/{step.target}
                  </span>
                </div>
                <p className="flex-1 text-2xs leading-snug text-muted-foreground">{copy.detail}</p>
                <div
                  className="h-2 overflow-hidden rounded-full bg-foreground/15"
                  role="progressbar"
                  aria-valuenow={step.progress}
                  aria-valuemin={0}
                  aria-valuemax={step.target}
                  aria-label={copy.title}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
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
          title={
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">{systemNodeTitle(node)}</h2>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {readonly
                  ? t`Historical versions are read-only.`
                  : decisions[0]
                    ? `${t`Decision`} · ${decisionCopy(decisions[0]).title}`
                    : t`Edit the selected node.`}
              </p>
            </div>
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
