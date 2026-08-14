import {
  CalendarDays,
  LayoutGrid,
  List,
  ListChecks,
  MoreVertical,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { SegmentedControl, type SegmentOption } from "@/components/SegmentedControl";
import { CardGridSkeleton } from "@/components/skeletons/card-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { checklistProgress, noteExcerpt } from "@/components/editor/markdown";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { JournalNote, JournalNoteType } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { intlLocale } from "@/lib/locale";
import { useNotesPrefs, type NotesLayout } from "@/lib/notesPrefs";
import { useUI } from "@/lib/ui";

export interface NotesViewProps {
  notes: JournalNote[];
  loading: boolean;
  error: boolean;
  onDelete: (id: string) => Promise<void>;
}

type TypeFilter = "all" | JournalNoteType;

const TYPE_OPTS: SegmentOption[] = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "daily_log", label: "Logs" },
];

const LAYOUT_OPTS: SegmentOption[] = [
  {
    value: "list",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <List size={13} strokeWidth={1.75} aria-hidden />
        List
      </span>
    ),
  },
  {
    value: "cards",
    label: (
      <span className="inline-flex items-center gap-1.5">
        <LayoutGrid size={13} strokeWidth={1.75} aria-hidden />
        Cards
      </span>
    ),
  },
];

const menuTriggerClass = cn(
  "flex size-8 cursor-pointer items-center justify-center rounded-md",
  "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
);

function localIsoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Constructing Intl.DateTimeFormat is ~100× the cost of formatting — reuse per locale. */
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(locale: string, withYear: boolean): Intl.DateTimeFormat {
  const key = `${locale}${withYear ? "|y" : ""}`;
  let fmt = dayFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
    dayFormatters.set(key, fmt);
  }
  return fmt;
}

/** "Today" / "Yesterday" for the two most recent days, otherwise a short date. */
function formatNoteDay(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;

  const today = new Date();
  if (isoDate === localIsoDay(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isoDate === localIsoDay(yesterday)) return "Yesterday";

  return dayFormatter(locale, d.getFullYear() !== today.getFullYear()).format(d);
}

const monthFormatters = new Map<string, Intl.DateTimeFormat>();

function monthFormatter(locale: string, withYear: boolean): Intl.DateTimeFormat {
  const key = `${locale}${withYear ? "|y" : ""}`;
  let fmt = monthFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
    });
    monthFormatters.set(key, fmt);
  }
  return fmt;
}

/** Section label a note files under — recency buckets first, then month headings. */
function noteDayBucket(isoDate: string, locale: string): string {
  const today = new Date();
  const todayIso = localIsoDay(today);
  if (isoDate === todayIso) return "Today";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isoDate === localIsoDay(yesterday)) return "Yesterday";

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (isoDate > localIsoDay(weekAgo) && isoDate < todayIso) return "This week";

  if (isoDate.slice(0, 7) === todayIso.slice(0, 7)) return "This month";

  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return monthFormatter(locale, d.getFullYear() !== today.getFullYear()).format(d);
}

/**
 * Everything derived from a note's body, flattened once per fetch so keystroke
 * filtering and tile renders never re-run the markdown/HTML regex chain.
 */
interface NoteRow {
  note: JournalNote;
  preview: string;
  progress: { done: number; total: number } | null;
  /** Lowercased title + body text + symbol cards, matched by the search filter. */
  search: string;
}

const PREVIEW_MAX = 140;

function toNoteRow(note: JournalNote): NoteRow {
  const flat = noteExcerpt(note.body, Number.MAX_SAFE_INTEGER);
  const symbols = note.symbols ?? [];

  let preview: string;
  if (flat) {
    preview = flat.length <= PREVIEW_MAX ? flat : `${flat.slice(0, PREVIEW_MAX - 1).trimEnd()}…`;
  } else if (note.type === "daily_log" && symbols.length > 0) {
    preview = `${symbols.length} symbol card${symbols.length === 1 ? "" : "s"}`;
  } else {
    preview = "No content yet.";
  }

  return {
    note,
    preview,
    progress: checklistProgress(note.body),
    search: [note.title, flat, ...symbols.flatMap((s) => [s.symbol, s.body])]
      .join("\n")
      .toLowerCase(),
  };
}

function NoteActionsMenu({
  title,
  onOpen,
  onDelete,
}: {
  title: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="contents"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Actions for ${title}`}
          className={cn(menuTriggerClass, menuOpen && "bg-accent text-foreground")}
        >
          <MoreVertical size={14} strokeWidth={1.5} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={4}
          className="min-w-[10.5rem] p-1"
        >
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              onOpen();
            }}
          >
            Open
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NoteTile({
  row,
  layout,
  onOpen,
  onDelete,
}: {
  row: NoteRow;
  layout: NotesLayout;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { note, preview, progress } = row;
  const locale = intlLocale();
  const isDailyLog = note.type === "daily_log";
  const symbols = note.symbols ?? [];
  const isCard = layout === "cards";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${note.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group/note flex cursor-pointer flex-col gap-2.5 rounded-lg bg-card p-4 text-left outline-none",
        "transition-colors duration-100 hover:bg-accent",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        // Off-screen tiles skip layout/paint; long collections scroll smoothly.
        "[content-visibility:auto]",
        isCard
          ? "h-full min-h-0 [contain-intrinsic-size:auto_11rem]"
          : "w-full [contain-intrinsic-size:auto_6.5rem]",
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-foreground">
            {note.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
              <CalendarDays size={12} strokeWidth={1.75} aria-hidden />
              {formatNoteDay(note.occurred_at, locale)}
            </span>
            <Pill tone={isDailyLog ? "accent" : "muted"} className="px-1.5 py-0 text-[10px]">
              {isDailyLog ? "Daily log" : "Note"}
            </Pill>
            {progress ? (
              <span
                className="inline-flex items-center gap-1 tabular-nums"
                title={`${progress.done} of ${progress.total} checks done`}
              >
                <ListChecks size={12} strokeWidth={1.75} aria-hidden />
                {progress.done}/{progress.total}
              </span>
            ) : null}
          </div>
        </div>
        <NoteActionsMenu title={note.title} onOpen={onOpen} onDelete={onDelete} />
      </header>

      <p
        className={cn(
          "min-w-0 text-[12px] leading-relaxed text-muted-foreground",
          isCard ? "line-clamp-4 flex-1" : "line-clamp-2",
        )}
      >
        {preview}
      </p>

      {symbols.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {symbols.map((s) => (
            <span
              key={s.symbol}
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary"
            >
              {s.symbol}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NotesView({ notes, loading, error, onDelete }: NotesViewProps) {
  const openModal = useUI((s) => s.openModal);
  const openNoteEdit = useUI((s) => s.openNoteEdit);
  const layout = useNotesPrefs((s) => s.layout);
  const setLayout = useNotesPrefs((s) => s.setLayout);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  // Keeps typing responsive: the input updates immediately, filtering lags a frame.
  const deferredQuery = useDeferredValue(query);

  const sorted = useMemo(
    () =>
      [...notes]
        .sort((a, b) => {
          const byDate = b.occurred_at.localeCompare(a.occurred_at);
          if (byDate !== 0) return byDate;
          return b.updated_at.localeCompare(a.updated_at);
        })
        .map(toNoteRow),
    [notes],
  );

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return sorted.filter(
      (r) =>
        (typeFilter === "all" || (r.note.type ?? "note") === typeFilter) &&
        (!q || r.search.includes(q)),
    );
  }, [sorted, typeFilter, deferredQuery]);

  const locale = intlLocale();
  // Consecutive-run grouping — `visible` is already date-desc, so buckets stay in order.
  const groups = useMemo(() => {
    const out: { label: string; rows: NoteRow[] }[] = [];
    for (const row of visible) {
      const label = noteDayBucket(row.note.occurred_at, locale);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [visible, locale]);

  const filtered = query.trim().length > 0 || typeFilter !== "all";

  function openNote(note: JournalNote) {
    openNoteEdit({
      id: note.id,
      type: note.type ?? "note",
      occurredAt: note.occurred_at,
      title: note.title,
      body: note.body,
      symbols: note.symbols ?? [],
    });
  }

  return (
    <Page fill>
      <header className="flex flex-col gap-3">
        {/* Title row — the primary action stays pinned top-right at every width. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-foreground">
              Notes
              {notes.length > 0 ? (
                <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                  {filtered ? `${visible.length} of ${notes.length}` : notes.length}
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Freeform notes and daily logs — <Kbd>⇧N</Kbd> starts a new one.
            </p>
          </div>
          <Button type="button" className="shrink-0" onClick={() => openModal("new-note")}>
            <Plus size={14} strokeWidth={1.75} />
            New note
          </Button>
        </div>

        {/* Toolbar row — search anchors left, view controls right; wraps cleanly. */}
        {notes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="h-8.5 w-full sm:h-7.5 sm:w-72">
              <InputGroupAddon>
                <Search size={14} strokeWidth={1.75} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Search notes"
                placeholder="Search notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton aria-label="Clear search" onClick={() => setQuery("")}>
                    <X size={13} strokeWidth={1.75} />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <div className="flex flex-1 items-center justify-end gap-2">
              <SegmentedControl
                ariaLabel="Filter notes by type"
                size="xs"
                options={TYPE_OPTS}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as TypeFilter)}
              />
              <SegmentedControl
                ariaLabel="Notes layout"
                size="xs"
                options={LAYOUT_OPTS}
                value={layout}
                onChange={(v) => setLayout(v as NotesLayout)}
              />
            </div>
          </div>
        ) : null}
      </header>

      {loading ? (
        layout === "cards" ? (
          <CardGridSkeleton
            count={3}
            className="min-h-0 flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            mediaClassName="h-36"
          />
        ) : (
          <ListSkeleton rows={3} className="min-h-0 flex-1" />
        )
      ) : error ? (
        <EmptyState title="Could not load notes" hint="Try refreshing the page." />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No notes yet"
          hint="Capture a session recap, discipline check, or market read — or start a daily log."
          icon={<StickyNote size={28} strokeWidth={1.5} />}
          actions={
            <Button type="button" onClick={() => openModal("new-note")}>
              <Plus size={14} strokeWidth={1.75} />
              New note
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matching notes"
          hint="Try a different search term or filter."
          icon={<Search size={28} strokeWidth={1.5} />}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : layout === "cards" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="sticky top-0 z-10 bg-background py-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.rows.map((row) => (
                  <NoteTile
                    key={row.note.id}
                    row={row}
                    layout="cards"
                    onOpen={() => openNote(row.note)}
                    onDelete={async () => {
                      await onDelete(row.note.id);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div role="list" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className="contents">
              <div
                role="presentation"
                className={cn("sticky top-0 z-10 bg-background py-1", groupIndex > 0 && "mt-3")}
              >
                <h3 className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {group.label}
                </h3>
              </div>
              {group.rows.map((row) => (
                <div key={row.note.id} role="listitem">
                  <NoteTile
                    row={row}
                    layout="list"
                    onOpen={() => openNote(row.note)}
                    onDelete={async () => {
                      await onDelete(row.note.id);
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
