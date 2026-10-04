import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JournalNote } from "@/lib/api/types";
import { useNotesPrefs } from "@/lib/notesPrefs";
import { useUI } from "@/lib/ui";
import { renderWithI18n } from "@/test/renderWithI18n";
import { NotesView } from "./NotesView";

const notes: JournalNote[] = [
  {
    id: "n1",
    type: "daily_log",
    occurred_at: "2026-07-22",
    title: "AM session",
    body: "## Review\n\nClean **break** of highs.\n\n- [x] Plan ready",
    symbols: [
      { symbol: "AAPL", body: "Held VWAP" },
      { symbol: "NVDA", body: "" },
    ],
    created_at: "2026-07-22T12:00:00Z",
    updated_at: "2026-07-22T12:00:00Z",
  },
  {
    id: "n2",
    type: "note",
    occurred_at: "2026-07-21",
    title: "Discipline check",
    body: "No revenge trades.",
    symbols: [],
    created_at: "2026-07-21T12:00:00Z",
    updated_at: "2026-07-21T12:00:00Z",
  },
];

describe("NotesView", () => {
  beforeEach(() => {
    useNotesPrefs.setState({ layout: "list" });
  });

  it("lists notes with daily-log badge and opens edit", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    renderWithI18n(<NotesView notes={notes} loading={false} error={false} onDelete={onDelete} />);

    expect(screen.getByText("AM session")).toBeInTheDocument();
    expect(screen.getByText("Daily log")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("NVDA")).toBeInTheDocument();
    expect(screen.getByText("Discipline check")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open AM session" }));
    expect(useUI.getState().modal).toBe("new-note");
    expect(useUI.getState().noteDraft?.type).toBe("daily_log");
    expect(useUI.getState().noteDraft?.symbols?.[0]?.symbol).toBe("AAPL");
    useUI.getState().closeModal();
  });

  it("switches between list and cards layout", async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <NotesView
        notes={notes}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cards/i }));
    expect(useNotesPrefs.getState().layout).toBe("cards");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open AM session" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /List/i }));
    expect(useNotesPrefs.getState().layout).toBe("list");
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("filters notes by search query across title, body and symbols", async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <NotesView
        notes={notes}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search notes" });
    await user.type(search, "revenge");
    expect(screen.getByText("Discipline check")).toBeInTheDocument();
    expect(screen.queryByText("AM session")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "nvda");
    expect(screen.getByText("AM session")).toBeInTheDocument();
    expect(screen.queryByText("Discipline check")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("No matching notes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("AM session")).toBeInTheDocument();
  });

  it("filters notes by type", async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <NotesView
        notes={notes}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Logs" }));
    expect(screen.getByText("AM session")).toBeInTheDocument();
    expect(screen.queryByText("Discipline check")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByText("Discipline check")).toBeInTheDocument();
    expect(screen.queryByText("AM session")).not.toBeInTheDocument();
  });

  it("labels weekly reviews, filters to them, and opens them as reviews", async () => {
    const user = userEvent.setup();
    const review: JournalNote = {
      id: "n3",
      type: "weekly_review",
      occurred_at: "2026-07-25",
      title: "Week of Jul 20 – Jul 26",
      body: "## Week in numbers\n\n- Net P&L: +$325.50\n\n## What worked\n\n",
      symbols: [],
      created_at: "2026-07-25T13:00:00Z",
      updated_at: "2026-07-25T13:00:00Z",
    };
    renderWithI18n(
      <NotesView
        notes={[...notes, review]}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByText("Weekly review")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reviews" }));
    expect(screen.getByText("Week of Jul 20 – Jul 26")).toBeInTheDocument();
    expect(screen.queryByText("AM session")).not.toBeInTheDocument();
    expect(screen.queryByText("Discipline check")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Week of Jul 20 – Jul 26" }));
    expect(useUI.getState().noteDraft?.type).toBe("weekly_review");
    useUI.getState().closeModal();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("AM session")).toBeInTheDocument();
  });

  it("shows checklist progress from the note body", () => {
    renderWithI18n(
      <NotesView
        notes={notes}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );
    expect(screen.getByTitle("1 of 1 checks done")).toBeInTheDocument();
  });

  it("shows empty state when there are no notes", () => {
    renderWithI18n(
      <NotesView
        notes={[]}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
  });
});
