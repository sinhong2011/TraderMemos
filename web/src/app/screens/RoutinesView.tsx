import { ArrowDown, ArrowUp, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { RoutineDay, RoutineHistory, RoutineItem, RoutineStage } from "@/lib/api/routines";
import { cn } from "@/lib/cn";
import { addDays, STAGES, WEEKDAY_SHORT, weekdaysLabel } from "@/lib/routines";

const MON_TO_FRI = [1, 2, 3, 4, 5];
/** Picker order: the trading week first. */
const PICKER_DAYS = [1, 2, 3, 4, 5, 6, 0];

const fmtPct = (r: number) => `${Math.round(r * 100)}%`;

function dayTitle(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// The day's run
// ---------------------------------------------------------------------------

export interface RoutineDayCardProps {
  day: string;
  today: string;
  data: RoutineDay | undefined;
  loading: boolean;
  error: boolean;
  hasItems: boolean;
  onCheck: (id: string, done: boolean) => void;
  onToday: () => void;
}

export function RoutineDayCard({
  day,
  today,
  data,
  loading,
  error,
  hasItems,
  onCheck,
  onToday,
}: RoutineDayCardProps) {
  const action = (
    <div className="flex items-center gap-2">
      {data && data.total > 0 && (
        <span
          className="text-xs font-medium text-muted-foreground tabular-nums"
          data-testid="routine-day-progress"
        >
          {data.done}/{data.total}
        </span>
      )}
      {day !== today && (
        <Button size="sm" variant="ghost" onClick={onToday}>
          Back to today
        </Button>
      )}
    </div>
  );

  const body = () => {
    if (loading) return <Skeleton height="160px" />;
    if (error) return <p className="text-xs text-destructive">Failed to load the routine.</p>;
    if (!hasItems) {
      return (
        <EmptyState
          title="No routine yet"
          hint="Add the things you do before, during and after a session below."
        />
      );
    }
    if (!data || data.total === 0) {
      return (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Nothing scheduled for {day === today ? "today" : "this day"}.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {STAGES.map((stage) => {
          const items = data.items.filter((it) => it.stage === stage.value);
          if (items.length === 0) return null;
          return (
            <section key={stage.value} className="flex flex-col gap-1">
              <h3 className="m-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {stage.label}
              </h3>
              {items.map((it) => (
                <label
                  key={it.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-accent",
                    it.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => onCheck(it.id, !it.done)}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  {it.title}
                </label>
              ))}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <Card title={dayTitle(day, today)} action={action}>
      {body()}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 13-week history
// ---------------------------------------------------------------------------

function cellTone(total: number, done: number, future: boolean, isToday: boolean): string {
  if (future) return "bg-transparent";
  if (total === 0) return "bg-muted/50";
  const r = done / total;
  // Today is still in progress: an untouched list isn't a missed one yet.
  if (r === 0) return isToday ? "bg-muted" : "bg-loss/30";
  if (r < 0.5) return "bg-profit/25";
  if (r < 1) return "bg-profit/55";
  return "bg-profit";
}

export interface RoutineHistoryCardProps {
  history: RoutineHistory | undefined;
  loading: boolean;
  error: boolean;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
}

export function RoutineHistoryCard({
  history,
  loading,
  error,
  today,
  selected,
  onSelect,
}: RoutineHistoryCardProps) {
  const body = () => {
    if (loading) return <Skeleton height="180px" />;
    if (error || !history) {
      return <p className="text-xs text-destructive">Failed to load routine history.</p>;
    }
    const byDay = new Map(history.days.map((d) => [d.day, d]));
    // Columns are weeks starting Monday, oldest first.
    const weeks: string[][] = [];
    for (let start = history.from; start <= history.to; start = addDays(start, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    }
    const stageRates = STAGES.map((s) => {
      const t = history.by_stage[s.value];
      return { ...s, rate: t && t.total > 0 ? t.done / t.total : null };
    }).filter((s) => s.rate != null);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat
            label="Completion"
            value={
              history.completion_rate == null ? "No list yet" : fmtPct(history.completion_rate)
            }
            testId="routine-completion"
          />
          <Stat
            label="Streak"
            value={`${history.streak} day${history.streak === 1 ? "" : "s"}`}
            testId="routine-streak"
          />
          {stageRates.map((s) => (
            <Stat key={s.value} label={s.label} value={fmtPct(s.rate ?? 0)} />
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1" role="grid" aria-label="Routine history">
          <div className="flex flex-col gap-1 pr-1">
            {PICKER_DAYS.map((d) => (
              <span
                key={d}
                className="flex h-4 items-center text-[10px] leading-none text-muted-foreground"
              >
                {d % 2 === 1 ? WEEKDAY_SHORT[d] : ""}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} className="flex flex-col gap-1" role="row">
              {week.map((day) => {
                const s = byDay.get(day);
                const future = day > today;
                const label = s ? `${day}: ${s.done}/${s.total}` : day;
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    disabled={future}
                    title={label}
                    aria-label={label}
                    aria-selected={day === selected}
                    onClick={() => onSelect(day)}
                    className={cn(
                      "size-4 shrink-0 cursor-pointer rounded-[3px] border-none p-0 disabled:cursor-default",
                      cellTone(s?.total ?? 0, s?.done ?? 0, future, day === today),
                      day === selected && "outline-2 outline-offset-1 outline-primary",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card title="Last 13 weeks" description="Pick a day to see or fix its ticks.">
      {body()}
    </Card>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-foreground" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function WeekdayPicker({
  value,
  onChange,
  label,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  label: string;
}) {
  const set = new Set(value);
  return (
    <div className="flex gap-0.5" role="group" aria-label={label}>
      {PICKER_DAYS.map((d) => {
        const on = set.has(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAY_SHORT[d]}
            // A routine with no days would never appear; the last day stays on.
            disabled={on && set.size === 1}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))
            }
            className={cn(
              "h-7 w-8 cursor-pointer rounded-md border-none text-[11px] font-medium transition-colors disabled:cursor-default",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {WEEKDAY_SHORT[d].slice(0, 2)}
          </button>
        );
      })}
    </div>
  );
}

function StageSelect({
  value,
  onChange,
  label,
}: {
  value: RoutineStage;
  onChange: (s: RoutineStage) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as RoutineStage)}
      className="h-7 cursor-pointer rounded-md border border-input bg-background px-2 text-xs text-foreground"
    >
      {STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function ItemTitle({ item, onRename }: { item: RoutineItem; onRename: (title: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft == null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(item.title)}
        className="min-w-0 flex-1 cursor-text truncate rounded-md border-none bg-transparent px-2 py-1 text-left text-[13px] text-foreground hover:bg-accent"
        title="Rename"
      >
        {item.title}
      </button>
    );
  }
  const commit = () => {
    const next = draft.trim();
    setDraft(null);
    if (next && next !== item.title) onRename(next);
  };
  return (
    <Input
      autoFocus
      aria-label={`Rename ${item.title}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className="min-w-0 flex-1"
      size="sm"
    />
  );
}

export interface RoutineEditorCardProps {
  items: RoutineItem[];
  loading: boolean;
  onCreate: (body: { title: string; stage: RoutineStage; weekdays: number[] }) => Promise<void>;
  onUpdate: (
    id: string,
    body: { title?: string; stage?: RoutineStage; weekdays?: number[] },
  ) => void;
  onArchive: (item: RoutineItem) => void;
  onMove: (stage: RoutineStage, ids: string[]) => void;
}

export function RoutineEditorCard({
  items,
  loading,
  onCreate,
  onUpdate,
  onArchive,
  onMove,
}: RoutineEditorCardProps) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<RoutineStage>("pre");
  const [weekdays, setWeekdays] = useState<number[]>(MON_TO_FRI);
  const [busy, setBusy] = useState(false);

  async function add() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onCreate({ title: t, stage, weekdays });
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Routine items"
      description="Changing an item's stage or days applies from today on; past days keep what they were."
    >
      {loading ? (
        <Skeleton height="120px" />
      ) : (
        <div className="flex flex-col gap-4">
          {STAGES.map((s) => {
            const rows = items.filter((it) => it.stage === s.value);
            if (rows.length === 0) return null;
            return (
              <section key={s.value} className="flex flex-col gap-1">
                <h3 className="m-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {s.label}
                </h3>
                {rows.map((it, i) => (
                  <div
                    key={it.id}
                    className="flex flex-wrap items-center gap-2 rounded-md py-1"
                    data-testid="routine-item-row"
                  >
                    <ItemTitle item={it} onRename={(next) => onUpdate(it.id, { title: next })} />
                    <span className="text-[11px] text-muted-foreground">
                      {weekdaysLabel(it.weekdays)}
                    </span>
                    <WeekdayPicker
                      label={`Days for ${it.title}`}
                      value={it.weekdays}
                      onChange={(days) => onUpdate(it.id, { weekdays: days })}
                    />
                    <StageSelect
                      label={`Stage for ${it.title}`}
                      value={it.stage}
                      onChange={(next) => onUpdate(it.id, { stage: next })}
                    />
                    <div className="flex items-center">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move ${it.title} up`}
                        disabled={i === 0}
                        onClick={() => {
                          const ids = rows.map((r) => r.id);
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          onMove(s.value, ids);
                        }}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Move ${it.title} down`}
                        disabled={i === rows.length - 1}
                        onClick={() => {
                          const ids = rows.map((r) => r.id);
                          [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                          onMove(s.value, ids);
                        }}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${it.title}`}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <MoreVertical size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onClick={() => onArchive(it)}>
                            <Trash2 size={14} />
                            Remove from routine
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}

          <form
            className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input
              aria-label="New routine item"
              placeholder="Add an item, e.g. Mark key levels"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-48 flex-1"
              size="sm"
            />
            <WeekdayPicker label="Days for the new item" value={weekdays} onChange={setWeekdays} />
            <StageSelect label="Stage for the new item" value={stage} onChange={setStage} />
            <Button type="submit" size="sm" disabled={!title.trim() || busy}>
              <Plus size={14} />
              Add
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export function RoutinesView({ children }: { children: React.ReactNode }) {
  return <Page>{children}</Page>;
}
