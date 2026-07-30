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
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { SegmentedControl, type SegmentOption } from "@/components/SegmentedControl";
import { CardGridSkeleton } from "@/components/skeletons/card-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { checklistProgress, noteExcerpt } from "@/components/editor/markdown";
import { Button } from "@/components/ui/button";
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

/** "Today" / "Yesterday" for the two most recent days, otherwise a short date. */
function formatNoteDay(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;

  const today = new Date();
  if (isoDate === localIsoDay(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isoDate === localIsoDay(yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  }).format(d);
}

/** Case-insensitive match over title, body text and symbol tickers. */
function matchesQuery(note: JournalNote, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (noteExcerpt(note.body, Number.MAX_SAFE_INTEGER).toLowerCase().includes(q)) return true;
  return (note.symbols ?? []).some(
    (s) => s.symbol.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
  );
}

function noteBodyPreview(note: JournalNote): string {
  const excerpt = noteExcerpt(note.body);
  if (excerpt) return excerpt;
  const symbols = note.symbols ?? [];
  if (note.type === "daily_log" && symbols.length > 0) {
    return `${symbols.length} symbol card${symbols.length === 1 ? "" : "s"}`;
  }
  return "No content yet.";
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
  note,
  layout,
  onOpen,
  onDelete,
}: {
  note: JournalNote;
  layout: NotesLayout;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const locale = intlLocale();
  const isDailyLog = note.type === "daily_log";
  const symbols = note.symbols ?? [];
  const isCard = layout === "cards";
  const progress = checklistProgress(note.body);

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
        isCard ? "h-full min-h-0" : "w-full",
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
        {noteBodyPreview(note)}
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

  const sorted = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const byDate = b.occurred_at.localeCompare(a.occurred_at);
        if (byDate !== 0) return byDate;
        return b.updated_at.localeCompare(a.updated_at);
      }),
    [notes],
  );

  const visible = useMemo(
    () =>
      sorted.filter(
        (n) =>
          (typeFilter === "all" || (n.type ?? "note") === typeFilter) && matchesQuery(n, query),
      ),
    [sorted, typeFilter, query],
  );

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
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Notes</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {notes.length > 0 && filtered
              ? `${visible.length} of ${notes.length} note${notes.length === 1 ? "" : "s"}`
              : "Freeform notes and daily logs. Tap to edit — Shift+N for a new one."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notes.length > 0 ? (
            <>
              <InputGroup className="h-8.5 w-full sm:h-7.5 sm:w-56">
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
            </>
          ) : null}
          <Button type="button" onClick={() => openModal("new-note")}>
            <Plus size={14} strokeWidth={1.75} />
            New note
          </Button>
        </div>
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
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((note) => (
            <NoteTile
              key={note.id}
              note={note}
              layout="cards"
              onOpen={() => openNote(note)}
              onDelete={async () => {
                await onDelete(note.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div role="list" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visible.map((note) => (
            <div key={note.id} role="listitem">
              <NoteTile
                note={note}
                layout="list"
                onOpen={() => openNote(note)}
                onDelete={async () => {
                  await onDelete(note.id);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
