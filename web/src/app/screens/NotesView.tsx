import {
  CalendarDays,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  StickyNote,
  Tags,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { SegmentedControl, type SegmentOption } from "@/components/SegmentedControl";
import { CardGridSkeleton } from "@/components/skeletons/card-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { noteExcerpt } from "@/components/editor/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { JournalNote } from "@/lib/api/types";
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

function formatNoteDay(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
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
        "group/note flex cursor-pointer flex-col rounded-lg bg-sidebar text-left outline-none",
        "transition-colors duration-100 hover:bg-card",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        isCard ? "min-h-0" : "w-full",
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tabular-nums">
            <CalendarDays
              size={13}
              strokeWidth={1.75}
              className="text-muted-foreground"
              aria-hidden
            />
            {formatNoteDay(note.occurred_at, locale)}
          </span>
          <h3 className="mt-1 truncate text-[14px] font-medium tracking-tight text-foreground">
            {note.title}
          </h3>
        </div>
        <NoteActionsMenu title={note.title} onOpen={onOpen} onDelete={onDelete} />
      </header>

      <div
        className={cn(
          "mx-4 flex flex-col rounded-md bg-background",
          isCard ? "gap-3.5 p-3.5" : "gap-3 p-3.5 sm:flex-row sm:items-stretch sm:gap-5",
        )}
      >
        {isDailyLog && symbols.length > 0 ? (
          <div className={cn("flex flex-col gap-3", !isCard && "sm:min-w-52 sm:shrink-0")}>
            <div className="flex items-start gap-2.5">
              <Tags
                size={15}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {symbols.map((s) => (
                  <span
                    key={s.symbol}
                    className="rounded-md bg-sidebar px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary"
                  >
                    {s.symbol}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("min-w-0", !isCard && "sm:flex-1")}>
          <p
            className={cn(
              "text-[12px] leading-relaxed text-muted-foreground",
              isCard ? "line-clamp-4" : "line-clamp-2 sm:line-clamp-3",
            )}
          >
            {noteBodyPreview(note)}
          </p>
        </div>
      </div>

      <footer className="flex items-center px-4 pt-3 pb-4">
        <Pill tone={isDailyLog ? "accent" : "muted"}>{isDailyLog ? "Daily log" : "Note"}</Pill>
      </footer>
    </div>
  );
}

export function NotesView({ notes, loading, error, onDelete }: NotesViewProps) {
  const openModal = useUI((s) => s.openModal);
  const openNoteEdit = useUI((s) => s.openNoteEdit);
  const layout = useNotesPrefs((s) => s.layout);
  const setLayout = useNotesPrefs((s) => s.setLayout);

  const sorted = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const byDate = b.occurred_at.localeCompare(a.occurred_at);
        if (byDate !== 0) return byDate;
        return b.updated_at.localeCompare(a.updated_at);
      }),
    [notes],
  );

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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-semibold tracking-wide text-chart-3">Notes</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Freeform notes and daily logs. Tap to edit — Shift+N for a new one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Notes layout"
            size="xs"
            options={LAYOUT_OPTS}
            value={layout}
            onChange={(v) => setLayout(v as NotesLayout)}
          />
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
      ) : layout === "cards" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((note) => (
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
        <div role="list" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {sorted.map((note) => (
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
