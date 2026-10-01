import { MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AmountInput } from "@/components/AmountInput";
import { Card } from "@/components/Card";
import { DateTimePicker } from "@/components/DateTimePicker";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { Page } from "@/components/Page";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type {
  MissedOutcome,
  MissedReason,
  MissedSummary,
  MissedTrade,
  MissedTradeBody,
} from "@/lib/api/missedTrades";
import type { Account, Setup } from "@/lib/api/types";
import { parseAmountToNumber } from "@/lib/amountInput";
import { cn } from "@/lib/cn";
import { isoToWallClock, useDisplayTimePrefs, wallClockToIso } from "@/lib/displayPrefs";
import { fmtDateTime } from "@/lib/format";

export const OUTCOMES: { value: MissedOutcome; label: string }[] = [
  { value: "unknown", label: "Not checked yet" },
  { value: "target", label: "Hit target" },
  { value: "stop", label: "Hit stop" },
  { value: "no_trigger", label: "Never triggered" },
];

export const REASONS: { value: MissedReason; label: string }[] = [
  { value: "", label: "No reason given" },
  { value: "hesitated", label: "Hesitated" },
  { value: "away", label: "Away from screen" },
  { value: "rules", label: "Outside my rules" },
  { value: "other", label: "Other" },
];

const reasonLabel = (r: string) => REASONS.find((x) => x.value === r)?.label ?? r;

/** Signed R, e.g. `+2.5R` / `-1R` / `0R`. */
export function fmtR(r: number): string {
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(2).replace(/0$/, "");
  return `${r > 0 ? "+" : r < 0 ? "-" : ""}${s}R`;
}

const rTone = (r: number) => (r > 0 ? "text-profit" : r < 0 ? "text-loss" : "text-foreground");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface MissedSummaryCardProps {
  summary: MissedSummary | undefined;
  loading: boolean;
  error: boolean;
  setupName: (id: string) => string;
}

export function MissedSummaryCard({ summary, loading, error, setupName }: MissedSummaryCardProps) {
  const body = () => {
    if (loading) return <Skeleton height="140px" />;
    if (error || !summary)
      return <p className="text-xs text-destructive">Failed to load summary.</p>;
    if (summary.count === 0) {
      return (
        <EmptyState
          title="No missed trades logged"
          hint="Log setups you saw and didn't take. They never touch your trade stats."
        />
      );
    }
    const pending = summary.outcomes.unknown;
    const maxAbs = Math.max(...summary.by_reason.map((g) => Math.abs(g.net_r)), 1);
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Kpi
            label="Would have made"
            value={summary.scored ? fmtR(summary.net_r) : "No outcomes yet"}
            tone={summary.scored ? rTone(summary.net_r) : undefined}
            sub={
              summary.avg_r != null
                ? `${fmtR(summary.avg_r)} per miss · ${summary.scored} scored`
                : "Set outcomes to score misses"
            }
            testId="missed-net-r"
          />
          <Kpi label="Left on the table" value={fmtR(summary.r_left)} sub="Target hits" />
          <Kpi label="Losses avoided" value={fmtR(-summary.r_avoided)} sub="Stop-outs" />
          <Kpi
            label="Logged"
            value={String(summary.count)}
            sub={pending ? `${pending} need an outcome` : "All checked"}
          />
        </div>
        {summary.unpriced > 0 && (
          <p className="m-0 text-[11px] text-muted-foreground">
            {summary.unpriced} target hit{summary.unpriced === 1 ? "" : "s"} without entry, stop and
            target can't be priced in R.
          </p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          <GroupList
            title="By reason"
            groups={summary.by_reason.map((g) => ({ ...g, label: reasonLabel(g.key) }))}
            maxAbs={maxAbs}
          />
          {summary.by_setup.length > 0 && (
            <GroupList
              title="By setup"
              groups={summary.by_setup.map((g) => ({ ...g, label: setupName(g.key) }))}
              maxAbs={Math.max(...summary.by_setup.map((g) => Math.abs(g.net_r)), 1)}
            />
          )}
        </div>
      </div>
    );
  };
  return (
    <Card
      title="What the misses would have made"
      description="Target hits count their planned R, stop-outs -1R, untriggered entries 0R."
    >
      {body()}
    </Card>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn("text-2xl font-semibold tabular-nums", tone ?? "text-foreground")}
        data-testid={testId}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function GroupList({
  title,
  groups,
  maxAbs,
}: {
  title: string;
  groups: { key: string; label: string; count: number; net_r: number; scored: number }[];
  maxAbs: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-foreground">
              {g.label}
              <span className="ml-1.5 text-[11px] text-muted-foreground">{g.count}</span>
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                g.scored ? rTone(g.net_r) : "text-muted-foreground",
              )}
            >
              {g.scored ? fmtR(g.net_r) : "Not scored"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", g.net_r >= 0 ? "bg-profit" : "bg-loss")}
              style={{ width: `${(Math.abs(g.net_r) / maxAbs) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface MissedListCardProps {
  trades: MissedTrade[];
  loading: boolean;
  error: boolean;
  setupName: (id: string) => string;
  onAdd: () => void;
  onEdit: (t: MissedTrade) => void;
  onDelete: (t: MissedTrade) => void;
  onOutcome: (t: MissedTrade, outcome: MissedOutcome) => void;
}

const fmtPrice = (v: number | null) => (v == null ? "" : String(v));

export function MissedListCard({
  trades,
  loading,
  error,
  setupName,
  onAdd,
  onEdit,
  onDelete,
  onOutcome,
}: MissedListCardProps) {
  useDisplayTimePrefs();
  const action = (
    <Button size="sm" onClick={onAdd}>
      <Plus size={14} />
      Log a miss
    </Button>
  );
  const body = () => {
    if (loading) return <Skeleton height="200px" />;
    if (error) return <p className="text-xs text-destructive">Failed to load missed trades.</p>;
    if (trades.length === 0) {
      return (
        <EmptyState
          title="Nothing logged in this range"
          hint="Saw a setup and didn't take it? Log it, then mark how it played out."
        />
      );
    }
    return (
      <ul className="m-0 flex list-none flex-col p-0">
        {trades.map((t) => {
          const plan = [t.entry, t.stop, t.target].every((p) => p != null)
            ? `${fmtPrice(t.entry)} · stop ${fmtPrice(t.stop)} · target ${fmtPrice(t.target)}`
            : t.entry != null
              ? `Entry ${fmtPrice(t.entry)}`
              : "No plan";
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md px-2 py-2.5 hover:bg-accent/50"
              data-testid="missed-row"
            >
              <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-foreground">
                  {t.symbol}{" "}
                  <span
                    className={cn(
                      "text-[11px] font-normal",
                      t.direction === "long" ? "text-profit" : "text-loss",
                    )}
                  >
                    {t.direction === "long" ? "Long" : "Short"}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDateTime(t.observed_at)}
                  {t.setup_id ? ` · ${setupName(t.setup_id)}` : ""}
                  {t.reason ? ` · ${reasonLabel(t.reason)}` : ""}
                </span>
              </div>
              <div className="flex min-w-36 flex-col gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                <span>{plan}</span>
                {t.planned_r != null && <span>Planned {t.planned_r.toFixed(2)}R</span>}
              </div>
              <NativeSelect
                aria-label={`Outcome for ${t.symbol}`}
                value={t.outcome}
                onChange={(e) => onOutcome(t, e.target.value as MissedOutcome)}
                className="w-40"
              >
                {OUTCOMES.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span
                className={cn(
                  "w-14 text-right text-[13px] font-semibold tabular-nums",
                  t.r == null ? "text-muted-foreground" : rTone(t.r),
                )}
              >
                {t.r == null ? "Pending" : fmtR(t.r)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${t.symbol}`}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(t)}>
                    <Pencil size={14} />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(t)}>
                    <Trash2 size={14} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>
    );
  };
  return (
    <Card title="Missed trades" action={action}>
      {body()}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

interface Draft {
  symbol: string;
  direction: "long" | "short";
  observedAt: string; // wall clock in the display timezone
  entry: string;
  stop: string;
  target: string;
  setupId: string;
  accountId: string;
  reason: MissedReason;
  outcome: MissedOutcome;
  notes: string;
}

function draftFrom(t: MissedTrade | null, defaultAccount: string): Draft {
  return {
    symbol: t?.symbol ?? "",
    direction: t?.direction ?? "long",
    observedAt: isoToWallClock(t?.observed_at ?? new Date().toISOString()),
    entry: t?.entry != null ? String(t.entry) : "",
    stop: t?.stop != null ? String(t.stop) : "",
    target: t?.target != null ? String(t.target) : "",
    setupId: t?.setup_id ?? "",
    accountId: t ? (t.account_id ?? "") : defaultAccount,
    reason: t?.reason ?? "",
    outcome: t?.outcome ?? "unknown",
    notes: t?.notes ?? "",
  };
}

/** The plan check the API applies, so the form can say what's wrong before saving. */
export function planProblem(d: {
  direction: "long" | "short";
  entry: number | null;
  stop: number | null;
  target: number | null;
}): string | null {
  const { entry, stop, target } = d;
  if (entry == null || stop == null || target == null) return null;
  if (d.direction === "long" && !(stop < entry && entry < target)) {
    return "A long needs its stop below entry and its target above it.";
  }
  if (d.direction === "short" && !(target < entry && entry < stop)) {
    return "A short needs its stop above entry and its target below it.";
  }
  return null;
}

export interface MissedTradeDrawerProps {
  open: boolean;
  editing: MissedTrade | null;
  setups: Setup[];
  accounts: Account[];
  defaultAccount: string;
  onClose: () => void;
  onSave: (id: string | null, body: MissedTradeBody) => Promise<void>;
}

export function MissedTradeDrawer(props: MissedTradeDrawerProps) {
  // Keyed on what is being edited so reopening always starts from that row
  // (or a blank form), never from a draft an earlier visit abandoned.
  const key = props.open ? (props.editing?.id ?? "new") : "closed";
  return <MissedTradeDrawerInner key={key} {...props} />;
}

function MissedTradeDrawerInner({
  open,
  editing,
  setups,
  accounts,
  defaultAccount,
  onClose,
  onSave,
}: MissedTradeDrawerProps) {
  const [d, setD] = useState<Draft>(() => draftFrom(editing, defaultAccount));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));

  const prices = {
    entry: parseAmountToNumber(d.entry),
    stop: parseAmountToNumber(d.stop),
    target: parseAmountToNumber(d.target),
  };
  const problem = planProblem({ direction: d.direction, ...prices });
  const plannedR =
    !problem && prices.entry != null && prices.stop != null && prices.target != null
      ? Math.abs(prices.target - prices.entry) / Math.abs(prices.entry - prices.stop)
      : null;

  async function save() {
    if (!d.symbol.trim()) {
      setError("Symbol is required.");
      return;
    }
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(editing?.id ?? null, {
        symbol: d.symbol.trim().toUpperCase(),
        direction: d.direction,
        observed_at: wallClockToIso(d.observedAt),
        entry: prices.entry,
        stop: prices.stop,
        target: prices.target,
        setup_id: d.setupId || null,
        account_id: d.accountId || null,
        reason: d.reason,
        outcome: d.outcome,
        notes: d.notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
      modal="trap-focus"
    >
      <DrawerContent>
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>{editing ? "Edit missed trade" : "Log a missed trade"}</DrawerTitle>
            <DrawerDescription>
              A setup you saw and didn't take. It stays out of your trade stats.
            </DrawerDescription>
          </div>
          <DrawerClose
            aria-label="Close"
            className="ml-auto flex cursor-pointer border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <DrawerBody>
          <form
            id="missed-trade-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbol" htmlFor="mt-symbol">
                <FormInput
                  id="mt-symbol"
                  value={d.symbol}
                  onChange={(e) => set("symbol", e.target.value)}
                  placeholder="NVDA"
                  autoComplete="off"
                />
              </Field>
              <Field label="Side">
                <SegmentedControl
                  ariaLabel="Side"
                  value={d.direction}
                  onChange={(v) => set("direction", v as "long" | "short")}
                  options={[
                    { value: "long", label: "Long" },
                    { value: "short", label: "Short" },
                  ]}
                />
              </Field>
            </div>
            <Field label="When you saw it" htmlFor="mt-time">
              <DateTimePicker
                id="mt-time"
                aria-label="When you saw it"
                value={d.observedAt}
                onChange={(v) => set("observedAt", v)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Entry" htmlFor="mt-entry">
                <AmountInput id="mt-entry" value={d.entry} onValueChange={(v) => set("entry", v)} />
              </Field>
              <Field label="Stop" htmlFor="mt-stop">
                <AmountInput id="mt-stop" value={d.stop} onValueChange={(v) => set("stop", v)} />
              </Field>
              <Field label="Target" htmlFor="mt-target">
                <AmountInput
                  id="mt-target"
                  value={d.target}
                  onValueChange={(v) => set("target", v)}
                />
              </Field>
            </div>
            <p
              className={cn(
                "m-0 -mt-2 text-[11px]",
                problem ? "text-destructive" : "text-muted-foreground",
              )}
              data-testid="missed-plan-hint"
            >
              {problem ??
                (plannedR != null
                  ? `Planned ${plannedR.toFixed(2)}R`
                  : "Entry, stop and target price the miss in R.")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Why you passed" htmlFor="mt-reason">
                <NativeSelect
                  id="mt-reason"
                  value={d.reason}
                  onChange={(e) => set("reason", e.target.value as MissedReason)}
                >
                  {REASONS.map((r) => (
                    <NativeSelectOption key={r.value} value={r.value}>
                      {r.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="How it played out" htmlFor="mt-outcome">
                <NativeSelect
                  id="mt-outcome"
                  value={d.outcome}
                  onChange={(e) => set("outcome", e.target.value as MissedOutcome)}
                >
                  {OUTCOMES.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Setup" htmlFor="mt-setup">
                <NativeSelect
                  id="mt-setup"
                  value={d.setupId}
                  onChange={(e) => set("setupId", e.target.value)}
                >
                  <NativeSelectOption value="">No setup</NativeSelectOption>
                  {setups.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Account" htmlFor="mt-account">
                <NativeSelect
                  id="mt-account"
                  value={d.accountId}
                  onChange={(e) => set("accountId", e.target.value)}
                >
                  <NativeSelectOption value="">No account</NativeSelectOption>
                  {accounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Notes" htmlFor="mt-notes">
              <FormTextarea
                id="mt-notes"
                value={d.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="What you saw, why you passed."
              />
            </Field>
            {error && (
              <p role="alert" className="m-0 text-xs text-destructive">
                {error}
              </p>
            )}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="missed-trade-form"
            disabled={saving}
            className="flex-1 sm:flex-none"
          >
            {editing ? "Save" : "Log miss"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function MissedTradesView({ children }: { children: React.ReactNode }) {
  return <Page>{children}</Page>;
}
