import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JournalNote } from "../../lib/api/types";
import { useNotesPrefs } from "../../lib/notesPrefs";
import { useUI } from "../../lib/ui";
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
    render(<NotesView notes={notes} loading={false} error={false} onDelete={onDelete} />);

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
    render(
      <NotesView
        notes={notes}
        loading={false}
        error={false}
        onDelete={vi.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Cards/i }));
    expect(useNotesPrefs.getState().layout).toBe("cards");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open AM session" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /List/i }));
    expect(useNotesPrefs.getState().layout).toBe("list");
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("shows empty state when there are no notes", () => {
    render(
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
