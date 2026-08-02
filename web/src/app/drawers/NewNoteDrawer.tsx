import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
import { isEditorEmpty } from "@/components/editor/markdown";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DatePicker } from "@/components/DatePicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { fieldError, Field } from "@/components/Field";
import { FormInput } from "@/components/FormInput";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { fieldLabelClass } from "@/components/field-styles";
import { notesApi } from "@/lib/api/notes";
import type { JournalNoteSymbol, JournalNoteType } from "@/lib/api/types";
import { settingsApi } from "@/lib/api/settings";
import { cn } from "@/lib/cn";
import { isoToWallClock } from "@/lib/displayPrefs";
import { formatHotkeyLabel } from "@/lib/hotkeys";
import { useUI } from "@/lib/ui";

function nowLocalDate(): string {
  return isoToWallClock(new Date()).slice(0, 10);
}

function emptySymbolCard(): JournalNoteSymbol & { key: string } {
  return { key: crypto.randomUUID(), symbol: "", body: "" };
}

const NOTE_TYPE_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "daily_log", label: "Daily log" },
];

const SAVE_HOTKEY_LABEL = formatHotkeyLabel("mod+enter");

export function NewNoteDrawer() {
  const open = useUI((s) => s.modal === "new-note");
  const consumeNoteDraft = useUI((s) => s.consumeNoteDraft);
  const closeModal = useUI((s) => s.closeModal);
  const toast = useToastManager();
  const queryClient = useQueryClient();

  const [noteType, setNoteType] = useState<JournalNoteType>("note");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [symbolCards, setSymbolCards] = useState<Array<JournalNoteSymbol & { key: string }>>([]);

  const isDailyLog = noteType === "daily_log";

  const form = useForm({
    formId: "new-note",
    defaultValues: {
      occurredAt: nowLocalDate(),
      title: "",
      body: "",
    },
    onSubmit: async ({ value }) => {
      const symbols = isDailyLog
        ? symbolCards
            .map((c) => ({
              symbol: c.symbol.trim().toUpperCase(),
              body: c.body.trim(),
            }))
            .filter((c) => c.symbol)
        : [];
      const trimmed = value.body.trim();
      // A title on its own is a valid note (a rule, a reminder) — only a fully
      // blank form is rejected.
      if (isEditorEmpty(trimmed) && symbols.length === 0 && !value.title.trim()) return;
      setSaving(true);
      try {
        const checklistBlock =
          isDailyLog && !editingId && checklist.length > 0
            ? `\n\nChecklist:\n${checklist
                .map((item) => `- [${checked[item] ? "x" : " "}] ${item}`)
                .join("\n")}`
            : "";
        const fallbackTitle = isDailyLog ? "Daily log" : "Untitled";
        const payload = {
          type: noteType,
          occurred_at: value.occurredAt,
          title: value.title.trim() || fallbackTitle,
          body: isEditorEmpty(trimmed) ? "" : `${trimmed}${checklistBlock}`,
          symbols,
        };
        const note = editingId
          ? await notesApi.update(editingId, payload)
          : await notesApi.create(payload);
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        toast.add({
          title: editingId
            ? isDailyLog
              ? "Daily log updated"
              : "Note updated"
            : isDailyLog
              ? "Daily log saved"
              : "Note saved",
          description: note.title,
        });
        close();
      } catch (e) {
        toast.add({
          title: editingId ? "Could not update note" : "Could not save note",
          description: e instanceof Error ? e.message : "Try again",
        });
      } finally {
        setSaving(false);
      }
    },
  });

  function reset() {
    form.reset();
    setNoteType("note");
    setChecked({});
    setEditingId(null);
    setSymbolCards([]);
    setChecklist([]);
    setEditorKey((k) => k + 1);
  }

  function close() {
    reset();
    closeModal();
  }

  useEffect(() => {
    if (!open) return;

    const draft = consumeNoteDraft();
    if (draft) {
      setEditingId(draft.id);
      setNoteType(draft.type ?? "note");
      form.setFieldValue("occurredAt", draft.occurredAt);
      form.setFieldValue("title", draft.title);
      form.setFieldValue("body", draft.body);
      setChecked({});
      setChecklist([]);
      setSymbolCards(
        (draft.symbols ?? []).map((s) => ({
          key: crypto.randomUUID(),
          symbol: s.symbol,
          body: s.body,
        })),
      );
      setEditorKey((k) => k + 1);
      return;
    }

    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/draft cycle
  }, [open]);

  useEffect(() => {
    if (!open || editingId != null || !isDailyLog) {
      if (!isDailyLog) setChecklist([]);
      return;
    }
    void settingsApi.getChecklistTemplate().then((t) => {
      setChecklist(t.items ?? []);
    });
  }, [open, isDailyLog, editingId]);

  const isEdit = editingId != null;
  const bodyValue = useStore(form.store, (s) => s.values.body);
  const titleValue = useStore(form.store, (s) => s.values.title);
  const namedSymbolCount = symbolCards.filter((c) => c.symbol.trim().length > 0).length;
  const canSave =
    !isEditorEmpty(bodyValue) ||
    titleValue.trim().length > 0 ||
    (isDailyLog && namedSymbolCount > 0);
  const checkedCount = checklist.filter((item) => checked[item]).length;

  return (
    <Drawer open={open} onOpenChange={(v) => !v && !saving && close()} modal="trap-focus">
      <DrawerContent className="data-[swipe-axis=x]:[--drawer-content-width:min(640px,calc(100vw-2*var(--drawer-inset)))]">
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>
              {isEdit ? (isDailyLog ? "Edit daily log" : "Edit note") : "New note"}
            </DrawerTitle>
            <DrawerDescription>
              {isDailyLog
                ? "Session notes for the day, plus optional symbol cards."
                : "Freeform journal note — ideas, rules, or anything worth keeping."}
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
            className="flex min-h-0 flex-1 flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            onKeyDown={(e) => {
              // ⌘/Ctrl+Enter saves from anywhere in the form — the rich-text body
              // swallows a plain Enter, so there is no other keyboard way out.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave && !saving) {
                e.preventDefault();
                void form.handleSubmit();
              }
            }}
          >
            {!isEdit ? (
              <SegmentedControl
                ariaLabel="Note type"
                fullWidth
                className="shrink-0"
                options={NOTE_TYPE_OPTIONS}
                value={noteType}
                onChange={(v) => {
                  const next = v as JournalNoteType;
                  setNoteType(next);
                  if (next !== "daily_log") {
                    setSymbolCards([]);
                    setChecklist([]);
                    setChecked({});
                  }
                  setEditorKey((k) => k + 1);
                }}
              />
            ) : null}

            <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start">
              <form.Field name="title">
                {(field) => (
                  <Field label="Title" htmlFor="note-title" className="sm:flex-1">
                    <FormInput
                      id="note-title"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={isDailyLog ? "Daily log, session recap…" : "Untitled note"}
                      autoFocus={isEdit}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="occurredAt">
                {(field) => (
                  <Field label="Date" htmlFor="note-date" className="sm:w-44 sm:shrink-0">
                    <DatePicker
                      id="note-date"
                      aria-label="Date"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                    />
                  </Field>
                )}
              </form.Field>
            </div>

            {isDailyLog && !isEdit && checklist.length > 0 && (
              <div className="shrink-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className={cn(fieldLabelClass, "mb-0")}>Daily checklist</span>
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {checkedCount}/{checklist.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 rounded-md bg-muted px-3 py-2">
                  {checklist.map((item) => (
                    <label
                      key={item}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 text-[13px] transition-colors",
                        checked[item] ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked[item])}
                        onChange={() => setChecked((c) => ({ ...c, [item]: !c[item] }))}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      {item}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <form.Field
              name="body"
              validators={{
                onSubmit: ({ value, fieldApi }) => {
                  if (!isEditorEmpty(value)) return undefined;
                  if (fieldApi.form.getFieldValue("title").trim()) return undefined;
                  if (isDailyLog && symbolCards.some((c) => c.symbol.trim())) return undefined;
                  return isDailyLog
                    ? "Add a day note, a title, or at least one symbol."
                    : "Add a title or some note content.";
                },
              }}
            >
              {(field) => (
                <Field
                  label={isDailyLog ? "Day notes" : "Notes"}
                  htmlFor="note-body"
                  error={fieldError(field.state.meta.errors)}
                  // Fills the drawer instead of leaving dead space under a short editor.
                  className="min-h-[13rem] flex-1"
                >
                  <RichTextEditor
                    key={`body-${noteType}-${editorKey}`}
                    id="note-body"
                    aria-label={isDailyLog ? "Day notes" : "Notes"}
                    aria-invalid={Boolean(fieldError(field.state.meta.errors))}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    placeholder={
                      isDailyLog ? "Market read, mindset, lessons for the day…" : "Write your note…"
                    }
                    minHeight={140}
                    autoFocus={!isEdit}
                    showHints
                    fill
                  />
                </Field>
              )}
            </form.Field>

            {isDailyLog ? (
              <div className="flex shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(fieldLabelClass, "mb-0")}>
                    Symbol cards
                    {namedSymbolCount > 0 ? (
                      <span className="ml-1.5 text-foreground tabular-nums">
                        {namedSymbolCount}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setSymbolCards((cards) => [...cards, emptySymbolCard()])}
                  >
                    <Plus size={12} strokeWidth={1.75} />
                    Add symbol
                  </Button>
                </div>
                {symbolCards.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    Link tickers you focused on today — each card keeps its own notes.
                  </p>
                ) : (
                  symbolCards.map((card, index) => (
                    <NoteSymbolCard
                      key={card.key}
                      card={card}
                      editorKey={`${editorKey}-${card.key}`}
                      onChange={(next) =>
                        setSymbolCards((cards) => cards.map((c, i) => (i === index ? next : c)))
                      }
                      onRemove={() =>
                        setSymbolCards((cards) => cards.filter((_, i) => i !== index))
                      }
                    />
                  ))
                )}
              </div>
            ) : null}
          </form>
        </DrawerBody>
        <DrawerFooter className="justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
            <Kbd>{SAVE_HOTKEY_LABEL}</Kbd> to save
          </span>
          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void form.handleSubmit()}
              loading={saving}
              disabled={!canSave || saving}
              className="flex-1 sm:flex-none"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : isDailyLog ? "Save log" : "Save note"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function NoteSymbolCard({
  card,
  editorKey,
  onChange,
  onRemove,
}: {
  card: JournalNoteSymbol & { key: string };
  editorKey: string;
  onChange: (next: JournalNoteSymbol & { key: string }) => void;
  onRemove: () => void;
}) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-3 rounded-md bg-accent p-3">
      <div className="flex items-center gap-2">
        <FormInput
          id={inputId}
          value={card.symbol}
          onChange={(e) =>
            onChange({ ...card, symbol: e.target.value.toUpperCase().replace(/\s+/g, "") })
          }
          placeholder="Ticker"
          aria-label="Symbol"
          className="h-9 max-w-[9rem] font-semibold tracking-wide text-primary"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${card.symbol || "symbol"} card`}
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </Button>
      </div>
      <RichTextEditor
        key={editorKey}
        value={card.body}
        onChange={(body) => onChange({ ...card, body })}
        placeholder={`What happened with ${card.symbol || "this symbol"}?`}
        minHeight={120}
        showHints={false}
        className="bg-sidebar hover:bg-card"
      />
    </div>
  );
}
