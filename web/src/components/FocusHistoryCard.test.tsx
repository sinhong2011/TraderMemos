import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { FocusHistory } from "@/lib/api/focus";
import { FocusHistoryCard } from "./FocusHistoryCard";

const history: FocusHistory = {
  weeks: [
    {
      week_start: "2026-09-28",
      note_id: "n2",
      note_title: "Week of Sep 28",
      items: [
        { text: "Only A setups", kept: false },
        { text: "Stop after two losses", kept: true },
      ],
    },
    {
      week_start: "2026-09-21",
      note_id: "n1",
      note_title: "Week of Sep 21",
      items: [
        { text: "Wait for the close", kept: true },
        { text: "Max three trades", kept: true },
      ],
    },
  ],
  items_total: 4,
  items_kept: 3,
  weeks_all_kept: 1,
};

describe("FocusHistoryCard", () => {
  it("totals kept items and fully kept weeks", () => {
    render(<FocusHistoryCard history={history} loading={false} error={false} />);
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("2 scored weeks")).toBeInTheDocument();
  });

  it("marks each item kept or not ticked", () => {
    render(<FocusHistoryCard history={history} loading={false} error={false} />);
    expect(screen.getAllByLabelText("Kept")).toHaveLength(3);
    expect(screen.getAllByLabelText("Not ticked")).toHaveLength(1);
    expect(screen.getByText("Only A setups")).toHaveClass("text-muted-foreground");
  });

  it("opens the review behind a week", async () => {
    const onOpenNote = vi.fn<(id: string) => void>();
    render(
      <FocusHistoryCard history={history} loading={false} error={false} onOpenNote={onOpenNote} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Sep 21/ }));
    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("explains how a week gets scored when there are none", () => {
    render(
      <FocusHistoryCard
        history={{ weeks: [], items_total: 0, items_kept: 0, weeks_all_kept: 0 }}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("No scored weeks in this range")).toBeInTheDocument();
  });
});
