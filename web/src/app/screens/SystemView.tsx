import { t } from "@lingui/core/macro";
import {
  CircleHelp,
  Compass,
  History,
  Lock,
  Pencil,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
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
import { FormInput, FormTextarea } from "@/components/FormInput";
import { Page } from "@/components/Page";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FollowTradeInspector } from "@/components/system-map/FollowTradeInspector";
import { InspectorFrame } from "@/components/system-map/InspectorFrame";
import { RuleEditor } from "@/components/system-map/RuleEditor";
import { SystemInspector } from "@/components/system-map/SystemInspector";
import { SystemMap } from "@/components/system-map/SystemMap";
import { SystemMapList } from "@/components/system-map/SystemMapList";
import {
  ClarityPill,
  NodeProgress,
  NodeIcon,
  systemNodeTitle,
} from "@/components/system-map/SystemNode";
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
  useRenameSystemVersion,
  useSaveSystemVersion,
  useStartSystemVersion,
  useTradingSystem,
} from "@/lib/hooks/useSystem";
import {
  CHANGE_REASONS,
  changedDecisions,
  changeReasonCopy,
  customRegimeLabel,
  decisionCopy,
  DECISIONS,
  emptyRule,
  planStepCopy,
  STANCES,
  VERSION_NAME_MAX,
  versionTitle,
} from "@/lib/system";
import {
  decisionsForNode,
  isMapNodeId,
  type MapNodeId,
  nodeClarity,
  STARTER_DECISIONS,
} from "@/lib/system-map";
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
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);
  const sys = systemQ.data;
  const mode: SystemMode = search.mode ?? "rules";
  const hasWorkspace = Boolean(sys && (sys.active || sys.draft || sys.history.length > 0));
  const shownVersion = sys?.draft ?? sys?.active ?? sys?.history[0] ?? null;

  /** Rules and Follow share one mounted editor; anything else remounts it and drops edits. */
  const guardLeave = (go: () => void) => {
    if (editorDirty) setPendingLeave(() => go);
    else go();
  };

  const setMode = (next: SystemMode) => {
    const go = () =>
      void navigate({
        search: (prev) => ({ ...prev, mode: next === "rules" ? undefined : next }),
        replace: true,
      });
    if (next === "review") guardLeave(go);
    else go();
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
                  "inline-flex max-w-72 items-center gap-2 rounded-full bg-muted/60 px-2.5 py-1 text-2xs font-medium",
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
                <span className="truncate">
                  {versionTitle(shownVersion)} · {versionStatusLabel(shownVersion.status)}
                </span>
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

      {sys && mode === "review" ? <SystemReviewPanel /> : null}
      {sys && (mode === "rules" || mode === "follow") ? (
        <SystemMapWorkspace
          mode={mode}
          onEditDraft={() => setMode("rules")}
          onDirtyChange={setEditorDirty}
        />
      ) : null}

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
            guardLeave(
              () =>
                void navigate({
                  search: (prev) => ({ ...prev, version: id, mode: undefined }),
                  replace: true,
                }),
            );
          }}
        />
      ) : null}

      <Dialog open={pendingLeave != null} onOpenChange={(v) => !v && setPendingLeave(null)}>
        <DialogContent className="max-w-[min(480px,94vw)]">
          <DialogHeader className="flex-col items-start gap-1.5 pr-12">
            <DialogTitle>{t`Unsaved changes`}</DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {t`Your draft has edits that aren't saved. Leaving now discards them.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPendingLeave(null)}>
              {t`Keep editing`}
            </Button>
            <Button
              type="button"
              variant="destructive-outline"
              onClick={() => {
                const go = pendingLeave;
                setPendingLeave(null);
                setEditorDirty(false);
                go?.();
              }}
            >
              {t`Discard and leave`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <DialogContent className="max-w-[min(480px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{t`Version history`}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
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
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm font-medium tabular-nums">{v.label}</span>
                      {v.name ? (
                        <span className="truncate text-sm text-muted-foreground">{v.name}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-2xs text-muted-foreground">
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

function SystemMapWorkspace({
  mode,
  onEditDraft,
  onDirtyChange,
}: {
  mode: "rules" | "follow";
  onEditDraft: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const toast = useToastManager();
  const systemQ = useTradingSystem();
  const sys = systemQ.data!;
  const start = useStartSystemVersion();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

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
      mode={mode}
      onEditDraft={onEditDraft}
      onDirtyChange={onDirtyChange}
    />
  );
}

function versionToBody(v: SystemVersion): SystemVersionBody {
  const regimes = { ...v.regimes };
  for (const stance of STANCES) {
    regimes[stance] = customRegimeLabel(stance, v.regimes);
  }
  return {
    label: v.label,
    rules: { ...emptyRules(), ...v.rules },
    open_questions: { ...v.open_questions },
    regimes,
    trade_types: { ...v.trade_types },
  };
}

function VersionEditor({
  selectedVersion,
  versions,
  sys,
  search,
  navigate,
  mode,
  onEditDraft,
  onDirtyChange,
}: {
  selectedVersion: SystemVersion;
  versions: SystemVersion[];
  sys: NonNullable<ReturnType<typeof useTradingSystem>["data"]>;
  search: { mode?: SystemMode; node?: MapNodeId; version?: string };
  navigate: ReturnType<typeof Route.useNavigate>;
  mode: "rules" | "follow";
  onEditDraft: () => void;
  onDirtyChange: (dirty: boolean) => void;
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameSeed, setRenameSeed] = useState(0);

  const dirty = useMemo(() => {
    if (readonly) return false;
    return JSON.stringify(draftBody) !== JSON.stringify(versionToBody(selectedVersion));
  }, [draftBody, selectedVersion, readonly]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const followVersion = sys.active ?? selectedVersion;

  return (
    <>
      {mode === "follow" ? (
        <p className="text-sm text-muted-foreground">
          {t`Walk the map one decision at a time and check each against the active rules.`}
        </p>
      ) : null}

      {mode === "rules" ? (
        <>
          <Card
            title={
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-medium text-muted-foreground">{t`Four-week plan`}</h2>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={t`About the four-week plan`}
                  >
                    <CircleHelp className="size-3" strokeWidth={1.75} aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="block max-w-[18rem] whitespace-normal px-2.5 py-1.5 text-left text-xs leading-relaxed"
                  >
                    {t`Progress is derived from your data — not a checklist you tick.`}
                  </TooltipContent>
                </Tooltip>
              </div>
            }
          >
            <ol className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
              {sys.plan.map((step, index) => {
                const copy = planStepCopy(step.key);
                const pct = Math.min(100, (100 * step.progress) / Math.max(1, step.target));
                return (
                  <li key={step.key}>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className="group flex w-full flex-col gap-1 rounded-md px-1 py-0.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <span className="truncate text-2xs font-medium text-foreground">
                            <span className="tabular-nums text-muted-foreground">{index + 1}.</span>{" "}
                            {copy.title}
                          </span>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                            {step.progress}/{step.target}
                          </span>
                        </div>
                        <div
                          className="h-1 overflow-hidden rounded-full bg-foreground/15"
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
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="block max-w-[16rem] whitespace-normal px-2.5 py-1.5 text-left text-xs leading-relaxed"
                      >
                        {copy.detail}
                      </TooltipContent>
                    </Tooltip>
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
                  {versionTitle(v)} · {versionStatusLabel(v.status)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={selectedVersion.name ? t`Rename this version` : t`Name this version`}
              title={selectedVersion.name ? t`Rename this version` : t`Name this version`}
              onClick={() => {
                setRenameSeed((n) => n + 1);
                setRenameOpen(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            {readonly ? (
              <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                {t`Read-only`}
              </span>
            ) : null}
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-warning-foreground">
                <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                {t`Unsaved changes`}
              </span>
            ) : null}
            <div className="ms-auto flex flex-wrap items-center gap-2">
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
                  <Plus className="size-4" aria-hidden />
                  {t`Start next version`}
                </Button>
              ) : null}
              {sys.draft && selectedVersion.id === sys.draft.id ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={discard.isPending}
                    onClick={() => setDiscardOpen(true)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {t`Discard draft`}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!dirty}
                    onClick={resetDraft}
                  >
                    {t`Cancel edits`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activate.isPending || dirty}
                    title={dirty ? t`Save your edits before activating` : undefined}
                    onClick={() => {
                      setActivateSeed((n) => n + 1);
                      setActivateOpen(true);
                    }}
                  >
                    <Rocket className="size-3.5" aria-hidden />
                    {t`Activate`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!dirty || save.isPending}
                    onClick={() =>
                      sys.draft &&
                      save.mutate(
                        { id: sys.draft.id, body: draftBody },
                        {
                          onSuccess: () => toast.add({ title: t`Draft saved` }),
                          onError: (e) =>
                            toast.add({ title: t`Could not save`, description: failMessage(e) }),
                        },
                      )
                    }
                  >
                    <Save className="size-3.5" aria-hidden />
                    {save.isPending ? t`Saving…` : t`Save`}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {!sys.active && sys.draft ? (
            <p className="flex items-start gap-1.5 text-2xs leading-snug text-muted-foreground">
              <Sparkles className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
              <span>
                {t`Start with ${STARTER_DECISIONS.map((d) => decisionCopy(d).title).join(", ")}. The rest can wait.`}
              </span>
            </p>
          ) : null}
        </>
      ) : null}

      {/* Map + inspector share one dotted surface (same level as the draft). */}
      <div className="system-workspace grid min-h-[min(640px,70vh)] flex-1 overflow-hidden rounded-lg lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="relative min-h-[min(520px,55vh)] min-w-0 lg:min-h-0">
          <div className="absolute inset-0 hidden md:block">
            <SystemMap
              systemId={sys.id}
              rules={mode === "follow" ? followVersion.rules : draftBody.rules}
              openQuestions={
                mode === "follow" ? followVersion.open_questions : draftBody.open_questions
              }
              selected={node}
              onSelect={setNode}
            />
          </div>
          <div className="p-3 md:hidden">
            <SystemMapList
              rules={mode === "follow" ? followVersion.rules : draftBody.rules}
              openQuestions={
                mode === "follow" ? followVersion.open_questions : draftBody.open_questions
              }
              selected={node}
              onSelect={setNode}
            />
          </div>
        </div>
        <div className="min-h-[320px] min-w-0 p-3 lg:min-h-0 lg:ps-0">
          {mode === "follow" ? (
            <SystemInspector panelKey={`follow-${node}`}>
              <FollowTradeInspector node={node} version={followVersion} onEditDraft={onEditDraft} />
            </SystemInspector>
          ) : (
            <InspectorFrame
              title={systemNodeTitle(node)}
              subtitle={
                readonly
                  ? t`${selectedVersion.label} · read-only`
                  : t`${selectedVersion.label} · draft`
              }
              icon={<NodeIcon id={node} className="size-4.5" />}
              meta={
                <>
                  <ClarityPill
                    clarity={nodeClarity(node, draftBody.rules, draftBody.open_questions)}
                  />
                  <NodeProgress
                    filled={decisions.filter((d) => draftBody.rules[d]?.text.trim()).length}
                    total={decisions.length}
                  />
                </>
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
            </InspectorFrame>
          )}
        </div>
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

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-[min(480px,94vw)]">
          <DialogHeader className="flex-col items-start gap-1.5 pr-12">
            <DialogTitle>{t`Discard ${selectedVersion.label}?`}</DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {t`The draft and every unsaved edit are deleted. Active and retired versions stay as they are. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDiscardOpen(false)}>
              {t`Keep draft`}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={discard.isPending}
              onClick={() => {
                const draftId = sys.draft?.id;
                if (!draftId) return;
                discard.mutate(draftId, {
                  onSuccess: () => {
                    setDiscardOpen(false);
                    toast.add({ title: t`Draft discarded` });
                  },
                  onError: (e) =>
                    toast.add({ title: t`Could not discard`, description: failMessage(e) }),
                });
              }}
            >
              {t`Discard draft`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RenameVersionDialog
        key={renameSeed}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        version={selectedVersion}
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

function RenameVersionDialog({
  open,
  onOpenChange,
  version,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: SystemVersion;
}) {
  const toast = useToastManager();
  const rename = useRenameSystemVersion();
  const [name, setName] = useState(version.name ?? "");
  const inputId = useId();
  const hintId = useId();
  const trimmed = name.trim().replace(/\s+/g, " ");
  const unchanged = trimmed === (version.name ?? "");

  const submit = () => {
    if (unchanged || rename.isPending) return;
    rename.mutate(
      { id: version.id, name: trimmed },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.add({ title: trimmed ? t`Version named` : t`Name removed` });
        },
        onError: (e) => toast.add({ title: t`Could not rename`, description: failMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(480px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>
            {version.name ? t`Rename ${version.label}` : t`Name ${version.label}`}
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {t`A short name makes versions easier to tell apart. The version number stays ${version.label}, and the rules don't change.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogBody className="gap-2 pt-1">
            <label htmlFor={inputId} className="text-sm font-medium">
              {t`Name`}
            </label>
            <FormInput
              id={inputId}
              autoFocus
              value={name}
              maxLength={VERSION_NAME_MAX}
              placeholder={t`e.g. Trend pullbacks, tighter stops`}
              aria-describedby={hintId}
              onChange={(e) => setName(e.target.value)}
            />
            <div id={hintId} className="flex justify-between gap-3 text-2xs text-muted-foreground">
              <span>{t`Leave empty to remove the name.`}</span>
              <span className="tabular-nums">
                {name.length}/{VERSION_NAME_MAX}
              </span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t`Cancel`}
            </Button>
            <Button type="submit" disabled={unchanged || rename.isPending}>
              {rename.isPending ? t`Saving…` : t`Save name`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="max-w-[min(480px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{t`Unsaved changes`}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
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
      <DialogContent className="max-w-[min(520px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{t`Activate ${draft ? versionTitle(draft) : ""}`}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {changed.length
              ? t`Give a reason for each changed decision. The previous active version becomes read-only history.`
              : t`This becomes the active system. You can revise later with a new draft.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {changed.map((d) => (
            <div key={d} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3">
              <div className="text-sm font-medium">{decisionCopy(d).title}</div>
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
